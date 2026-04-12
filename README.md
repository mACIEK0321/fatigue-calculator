# fatigue-calculator

## AI comparison setup

The optional AI comparison path now uses Groq through the OpenAI-compatible base URL.

### Backend environment

Set these variables in `backend/.env` or in your deployment environment:

```env
GROQ_API_KEY=your-groq-api-key
GROQ_BASE_URL=https://api.groq.com/openai/v1
GROQ_MODEL=openai/gpt-oss-20b
GROQ_RESPONSE_FORMAT=auto
GROQ_TIMEOUT_SECONDS=20
ALLOWED_ORIGINS=http://localhost:3000
```

`GROQ_RESPONSE_FORMAT` supports:

- `auto`: try `json_schema` first and fall back to `json_object` only when the model rejects `json_schema`
- `json_schema`: force schema mode only
- `json_object`: force JSON object mode only

### Local run

From `backend/`:

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

From `frontend/`:

```powershell
npm run dev
```

### Compare endpoint check

```powershell
curl -X POST http://127.0.0.1:8000/api/analyze/compare `
  -H "Content-Type: application/json" `
  -d "{\"max_stress\":180,\"min_stress\":-20,\"material\":{\"uts\":395,\"yield_strength\":295,\"elastic_modulus\":210},\"sn_curve_source\":{\"mode\":\"material_basquin\"},\"surface_factor_selection\":{\"mode\":\"empirical_surface_finish\",\"finish_type\":\"machined\"},\"marin_factors\":{\"size_factor\":1,\"load_factor\":1,\"temperature_factor\":1,\"reliability_factor\":1},\"selected_mean_stress_model\":\"goodman\",\"ai_comparison\":{\"enabled\":true,\"include_interpreted_inputs\":true,\"include_sn_curve_points\":true,\"include_goodman_or_haigh_points\":true,\"max_points_per_series\":25}}"
```

### Migration from DeepSeek

Replace:

```env
DEEPSEEK_API_KEY
DEEPSEEK_BASE_URL
DEEPSEEK_MODEL
DEEPSEEK_TIMEOUT_SECONDS
```

with:

```env
GROQ_API_KEY
GROQ_BASE_URL
GROQ_MODEL
GROQ_TIMEOUT_SECONDS
```
