"""API router for fatigue analysis endpoints."""

import logging

from fastapi import APIRouter, HTTPException

from app.core.config import settings
from app.core.fatigue_engine import (
    calculate_surface_factor,
    run_full_analysis,
)
from app.models.schemas import (
    AIComparisonErrorCode,
    AIComparisonMetadata,
    FatigueAnalysisCompareRequest,
    FatigueAnalysisCompareResponse,
    FatigueAnalysisRequest,
    FatigueAnalysisResponse,
    SurfaceFinishInput,
)
from app.services.groq_client import GroqClient, GroqClientError

router = APIRouter(prefix="/api", tags=["analysis"])
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Material presets
# ---------------------------------------------------------------------------
MATERIAL_PRESETS: list[dict] = [
    {
        "name": "AISI 1020 Steel",
        "uts": 395.0,
        "yield_strength": 295.0,
        "endurance_limit": None,
        "elastic_modulus": 210.0,
        "fatigue_strength_coefficient": 691.0,
        "fatigue_strength_exponent": -0.085,
        "fatigue_ductility_coefficient": 0.25,
        "fatigue_ductility_exponent": -0.6,
    },
    {
        "name": "AISI 4340 Steel",
        "uts": 1090.0,
        "yield_strength": 1005.0,
        "endurance_limit": None,
        "elastic_modulus": 210.0,
        "fatigue_strength_coefficient": 1910.0,
        "fatigue_strength_exponent": -0.09,
        "fatigue_ductility_coefficient": 0.22,
        "fatigue_ductility_exponent": -0.56,
    },
    {
        "name": "7075-T6 Aluminum",
        "uts": 572.0,
        "yield_strength": 503.0,
        "endurance_limit": 159.0,
        "elastic_modulus": 71.7,
        "fatigue_strength_coefficient": 1317.0,
        "fatigue_strength_exponent": -0.122,
        "fatigue_ductility_coefficient": 0.19,
        "fatigue_ductility_exponent": -0.52,
    },
    {
        "name": "Ti-6Al-4V Titanium",
        "uts": 950.0,
        "yield_strength": 880.0,
        "endurance_limit": 510.0,
        "elastic_modulus": 113.8,
        "fatigue_strength_coefficient": 1667.0,
        "fatigue_strength_exponent": -0.095,
        "fatigue_ductility_coefficient": 0.35,
        "fatigue_ductility_exponent": -0.69,
    },
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def get_groq_client() -> GroqClient:
    return GroqClient(settings)


def _resolve_surface_factor(request: FatigueAnalysisRequest) -> float:
    mat = request.material

    if request.surface_factor_selection.mode.value == "empirical_surface_finish":
        return calculate_surface_factor(
            request.surface_factor_selection.finish_type.value,
            mat.uts,
        )

    return request.surface_factor_selection.surface_factor


def _run_native_analysis(request: FatigueAnalysisRequest) -> tuple[dict, float]:
    """Execute the native fatigue analysis and return the result plus resolved ka."""
    mat = request.material
    ka = _resolve_surface_factor(request)

    result = run_full_analysis(
        max_stress=request.max_stress,
        min_stress=request.min_stress,
        uts=mat.uts,
        yield_strength=mat.yield_strength,
        endurance_limit=mat.endurance_limit,
        elastic_modulus_gpa=mat.elastic_modulus,
        fatigue_strength_coefficient=mat.fatigue_strength_coefficient,
        fatigue_strength_exponent=mat.fatigue_strength_exponent,
        fatigue_ductility_coefficient=mat.fatigue_ductility_coefficient,
        fatigue_ductility_exponent=mat.fatigue_ductility_exponent,
        ka=ka,
        kb=request.marin_factors.size_factor,
        kc=request.marin_factors.load_factor,
        kd=request.marin_factors.temperature_factor,
        ke=request.marin_factors.reliability_factor,
        num_points=request.num_points,
        selected_mean_stress_model=request.selected_mean_stress_model.value,
        sn_curve_source_mode=request.sn_curve_source.mode.value,
        sn_fit_points=(
            [point.model_dump() for point in request.sn_curve_source.points]
            if request.sn_curve_source.points
            else None
        ),
        notch=request.notch.model_dump() if request.notch else None,
        loading_blocks=(
            [block.model_dump() for block in request.loading_blocks]
            if request.loading_blocks
            else None
        ),
    )
    return result, ka


def _build_ai_comparison_payload(
    request: FatigueAnalysisCompareRequest,
    native_analysis: dict,
    ka: float,
) -> dict:
    return {
        "material": request.material.model_dump(),
        "sn_curve_source": {
            "mode": request.sn_curve_source.mode.value,
            "input_points": (
                [point.model_dump() for point in request.sn_curve_source.points]
                if request.sn_curve_source.points
                else []
            ),
            "resolved_basquin_parameters": native_analysis["sn_curve_source"][
                "basquin_parameters"
            ],
            "resolved_fit": native_analysis["sn_curve_source"]["basquin_fit"],
        },
        "stress_state": native_analysis["stress_state"],
        "surface_factor": {
            "mode": request.surface_factor_selection.mode.value,
            "finish_type": (
                request.surface_factor_selection.finish_type.value
                if request.surface_factor_selection.finish_type is not None
                else None
            ),
            "effective_ka": ka,
        },
        "marin_factors": request.marin_factors.model_dump(),
        "selected_mean_stress_model": request.selected_mean_stress_model.value,
        "notch_correction": request.notch.model_dump() if request.notch else None,
        "loading_blocks": (
            [block.model_dump() for block in request.loading_blocks]
            if request.loading_blocks
            else []
        ),
        "flags": request.ai_comparison.model_dump(),
    }


def _build_ai_status(
    *,
    enabled: bool,
    status: str,
    result: dict | None = None,
    metadata: dict | None = None,
    error_code: AIComparisonErrorCode | None = None,
    error_message: str | None = None,
    retriable: bool = False,
) -> dict:
    return {
        "provider": "groq",
        "enabled": enabled,
        "status": status,
        "result": result,
        "metadata": metadata,
        "error": (
            {
                "code": error_code,
                "message": error_message,
                "retriable": retriable,
            }
            if error_code is not None and error_message is not None
            else None
        ),
    }


async def _run_ai_comparison(
    request: FatigueAnalysisCompareRequest,
    native_analysis: dict,
    ka: float,
) -> dict:
    if not request.ai_comparison.enabled:
        return _build_ai_status(
            enabled=False,
            status="skipped",
            metadata=AIComparisonMetadata().model_dump(),
            error_code=AIComparisonErrorCode.disabled,
            error_message="AI comparison was not requested for this analysis.",
        )

    payload = _build_ai_comparison_payload(request, native_analysis, ka)
    client = get_groq_client()

    try:
        result = await client.compare_fatigue_analysis(payload)
    except GroqClientError as exc:
        logger.warning("AI comparison failed code=%s", exc.code.value)
        return _build_ai_status(
            enabled=True,
            status="error",
            metadata=AIComparisonMetadata(
                response_format=exc.response_format,
                schema_profile=exc.schema_profile or AIComparisonMetadata().schema_profile,
                schema_simplified=exc.schema_simplified,
                attempted_response_formats=list(exc.attempted_response_formats),
                fallback_used=exc.fallback_used,
                problematic_fields=list(exc.problematic_fields),
                validation_issue_count=len(exc.validation_issues),
                validation_issues=list(exc.validation_issues),
            ).model_dump(),
            error_code=exc.code,
            error_message=exc.message,
            retriable=exc.retriable,
        )
    except Exception:
        logger.exception("Unexpected AI comparison failure")
        return _build_ai_status(
            enabled=True,
            status="error",
            error_code=AIComparisonErrorCode.unexpected_error,
            error_message="AI comparison failed due to an unexpected internal error.",
            retriable=False,
        )

    return _build_ai_status(
        enabled=True,
        status="success",
        result=result.result.model_dump(),
        metadata=result.metadata.model_dump(),
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@router.post("/analyze", response_model=FatigueAnalysisResponse)
async def analyze_fatigue(request: FatigueAnalysisRequest) -> dict:
    """Perform a complete fatigue life analysis."""
    try:
        result, _ = _run_native_analysis(request)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Unexpected fatigue analysis failure")
        raise HTTPException(
            status_code=500,
            detail="Fatigue analysis failed due to an internal server error.",
        ) from exc

    return result


@router.post("/analyze/compare", response_model=FatigueAnalysisCompareResponse)
async def analyze_fatigue_with_comparison(
    request: FatigueAnalysisCompareRequest,
) -> dict:
    """Perform native analysis and optionally add an AI comparison."""
    try:
        native_analysis, ka = _run_native_analysis(request)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Unexpected fatigue comparison failure")
        raise HTTPException(
            status_code=500,
            detail="Fatigue analysis failed due to an internal server error.",
        ) from exc

    ai_comparison = await _run_ai_comparison(request, native_analysis, ka)
    return {
        "native_analysis": native_analysis,
        "ai_comparison": ai_comparison,
    }


@router.post("/surface-factor")
async def compute_surface_factor(
    request: SurfaceFinishInput,
) -> dict[str, float]:
    """Calculate the Marin surface finish factor ka.

    Uses empirical coefficients based on surface finish type and UTS.
    """
    try:
        factor = calculate_surface_factor(
            request.finish_type.value, request.uts
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return {"surface_factor": factor}


@router.get("/materials/presets")
async def get_material_presets() -> list[dict]:
    """Return a list of common material presets with pre-filled properties.

    Includes AISI 1020 Steel, AISI 4340 Steel, 7075-T6 Aluminum,
    and Ti-6Al-4V Titanium.
    """
    return MATERIAL_PRESETS
