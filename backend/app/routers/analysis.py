"""API router for fatigue analysis endpoints.

Provides endpoints for full fatigue analysis, surface factor calculation,
and material preset retrieval.
"""

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
    """Perform a complete fatigue life analysis.

    Accepts cyclic loading parameters and material properties, returns
    stress characterization, modified endurance limit, cycles to failure,
    mean stress corrections, S-N curve data, and failure envelopes.
    """
    mat = request.material

    # Determine Marin factors
    ka = 1.0
    kb = 1.0
    kc = 1.0
    kd = 1.0
    ke = 1.0

    # If surface finish is provided, calculate ka from empirical formula
    if request.surface_finish is not None:
        try:
            ka = calculate_surface_factor(
                request.surface_finish.finish_type.value,
                request.surface_finish.uts,
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    # Override with explicit Marin factors if provided
    if request.marin_factors is not None:
        mf = request.marin_factors
        # Only override ka from marin_factors if surface_finish was NOT given
        if request.surface_finish is None:
            ka = mf.surface_factor
        kb = mf.size_factor
        kc = mf.load_factor
        kd = mf.temperature_factor
        ke = mf.reliability_factor

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
            kb=kb,
            kc=kc,
            kd=kd,
            ke=ke,
            num_points=request.num_points,
            selected_mean_stress_model=request.selected_mean_stress_model.value,
            sn_fit_points=(
                [point.model_dump() for point in request.sn_fit_points]
                if request.sn_fit_points
                else None
            ),
            notch=request.notch.model_dump() if request.notch else None,
            loading_blocks=(
                [block.model_dump() for block in request.loading_blocks]
                if request.loading_blocks
                else None
            ),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Analysis failed: {exc}",
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
