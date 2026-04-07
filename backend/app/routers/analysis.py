"""API router for fatigue analysis endpoints."""

import logging

from fastapi import APIRouter, HTTPException

from app.core.fatigue_engine import (
    calculate_surface_factor,
    run_full_analysis,
)
from app.models.schemas import (
    FatigueAnalysisRequest,
    FatigueAnalysisResponse,
    SurfaceFinishInput,
)

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
# Endpoints
# ---------------------------------------------------------------------------
@router.post("/analyze", response_model=FatigueAnalysisResponse)
async def analyze_fatigue(request: FatigueAnalysisRequest) -> dict:
    """Perform a complete fatigue life analysis."""
    mat = request.material

    try:
        if request.surface_factor_selection.mode.value == "empirical_surface_finish":
            ka = calculate_surface_factor(
                request.surface_factor_selection.finish_type.value,
                mat.uts,
            )
        else:
            ka = request.surface_factor_selection.surface_factor
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    try:
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
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Unexpected fatigue analysis failure")
        raise HTTPException(
            status_code=500,
            detail="Fatigue analysis failed due to an internal server error.",
        ) from exc

    return result


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
