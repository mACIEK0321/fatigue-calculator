export type SlideType =
  | "title"
  | "bullets"
  | "pipeline"
  | "prompt"
  | "prompt-anatomy"
  | "comparison"
  | "conclusions"
  | "status";

export type SlideBadge =
  | "Wstep"
  | "Problem"
  | "Teoria"
  | "Pipeline"
  | "Architektura"
  | "Proces"
  | "Modele AI"
  | "Prompty"
  | "Problemy"
  | "Stan"
  | "Wnioski";

export interface BulletItem {
  text: string;
  sub?: string[];
}

export interface PipelineStep {
  label: string;
  detail?: string;
}

export interface ComparisonColumn {
  heading: string;
  items: string[];
}

export interface PromptBlock {
  label: string;
  code: string;
  variant?: "neutral" | "warning";
}

export interface PromptAnatomySection {
  label: string;
  value: string;
}

export interface PromptAnatomy {
  kind: "analityczny" | "wykonawczy" | "naprawczy";
  purpose: string;
  when: string;
  sections: PromptAnatomySection[];
  example: string;
}

export interface Slide {
  id: number;
  type: SlideType;
  badge?: SlideBadge;
  title: string;
  subtitle?: string;
  intro?: string;
  bullets?: BulletItem[];
  pipeline?: PipelineStep[];
  prompt?: PromptBlock;
  promptAnatomy?: PromptAnatomy;
  columns?: ComparisonColumn[];
  conclusions?: { heading: string; body: string }[];
  statusDone?: string[];
  statusPending?: string[];
  note?: string;
}

export const slides: Slide[] = [
  // ─── 1. TYTUL ────────────────────────────────────────────────────────────
  {
    id: 1,
    type: "title",
    badge: "Wstep",
    title: "Fatigue Calculator",
    subtitle: "Inzynieryjna analiza zmeczeniowa wspomagana przez AI",
    note: "Projekt inzynierski - AI-assisted development",
  },

  // ─── 2. PROBLEM INZYNIERSKI ──────────────────────────────────────────────
  {
    id: 2,
    type: "bullets",
    badge: "Problem",
    title: "Problem inzynierski",
    subtitle: "Samo naprezenie statyczne to za malo",
    bullets: [
      {
        text: "MES dostarcza naprezenie w MPa - wynik statyczny, bez informacji o trwalosci.",
      },
      {
        text: "Obciazenia rzeczywiste sa cykliczne: silniki, mosty, zawieszenia, spawy.",
      },
      {
        text: "Ocena trwalosci wymaga osobnej analizy zmeczeniowej:",
        sub: [
          "charakter cyklu - R = sigma_min / sigma_max",
          "akumulacja uszkodzen - regula Minera",
          "krzywa S-N materialu",
          "czynniki korekcyjne: powierzchnia, karb, temperatura",
        ],
      },
    ],
  },

  // ─── 3. TEORIA ZMECZENIOWA ───────────────────────────────────────────────
  {
    id: 3,
    type: "bullets",
    badge: "Teoria",
    title: "Teoria zmeczeniowa",
    subtitle: "Od naprezenia do liczby cykli",
    bullets: [
      {
        text: "Krzywa S-N (Wohlera) - amplituda naprezenia vs. cykle do zniszczenia.",
      },
      {
        text: "Granica zmeczeniowa S_e - ponizej niej element teoretycznie nie ulega zniszczeniu.",
      },
      {
        text: "Korekcje Marin - przystosowanie S_e do rzeczywistych warunkow:",
        sub: [
          "k_a - chropowatosc powierzchni",
          "k_b - rozmiar, k_c - rodzaj obciazenia",
          "k_d, k_e, k_f - temperatura, niezawodnosc, dodatkowe",
        ],
      },
      {
        text: "Modele naprezenia sredniego: Goodman, Gerber, Soderberg, Morrow.",
      },
    ],
  },

  // ─── 4. ZAKRES FUNKCJONALNY ──────────────────────────────────────────────
  {
    id: 4,
    type: "pipeline",
    badge: "Pipeline",
    title: "Zakres funkcjonalny",
    subtitle: "Od danych MES do oceny projektowej",
    pipeline: [
      {
        label: "Material",
        detail: "Presety: AISI 1020, 4340, Al 7075-T6, Ti-6Al-4V - lub wlasne parametry",
      },
      {
        label: "Naprezenia",
        detail: "sigma_max / sigma_min lub amplituda + srednia; odczyt ze screenshota MES (Vision AI)",
      },
      {
        label: "Krzywa S-N",
        detail: "Parametry Basquina lub wlasne punkty z dopasowaniem regresyjnym",
      },
      {
        label: "Korekcje",
        detail: "Czynniki Marin k_a...k_f, wspolczynnik karbu K_f, model naprezenia sredniego",
      },
      {
        label: "Wyniki",
        detail: "S_e zmodyfikowane, liczba cykli N, SF, wykres S-N, diagram Goodmana, interpretacja AI",
      },
    ],
  },

  // ─── 5. ARCHITEKTURA TECHNICZNA ──────────────────────────────────────────
  {
    id: 5,
    type: "bullets",
    badge: "Architektura",
    title: "Architektura techniczna",
    subtitle: "Stack i podzial warstw",
    bullets: [
      {
        text: "Frontend - Next.js 15 + React 19 + TypeScript",
        sub: ["Tailwind CSS 4 + Radix UI", "Recharts - wykresy S-N i Goodman"],
      },
      {
        text: "Backend - FastAPI + Python",
        sub: ["NumPy / SciPy - obliczenia i regresja S-N", "Pydantic - walidacja danych"],
      },
      {
        text: "AI / Vision - Groq API",
        sub: [
          "/vision/stress-from-image - odczyt naprezen z MES",
          "/analyze/interpret - LLM interpretacja wynikow",
          "JSON Schema response mode + fallback json_object",
        ],
      },
      {
        text: "Infrastruktura - Docker + .env, gotowe pod Hetzner Cloud.",
      },
    ],
  },

  // ─── 6. PROCES POWSTAWANIA ───────────────────────────────────────────────
  {
    id: 6,
    type: "pipeline",
    badge: "Proces",
    title: "Jak powstawala aplikacja",
    subtitle: "AI jako narzedzie, nie autor",
    pipeline: [
      {
        label: "Analiza problemu",
        detail: "Zrozumienie domeny, wzorow zmeczeniowych, wymagan funkcjonalnych",
      },
      {
        label: "Rozmowa z ChatGPT",
        detail: "Opis problemu w jezyku naturalnym - ustalenie zakresu i architektury",
      },
      {
        label: "Generowanie promptow",
        detail: "ChatGPT tworzy precyzyjne instrukcje dla modeli kodujacych - jeden task = jeden prompt",
      },
      {
        label: "Generowanie kodu",
        detail: "Claude Code / GPT w VS Code pracuja na dobrze zdefiniowanych taskach",
      },
      {
        label: "Weryfikacja",
        detail: "Sprawdzenie wzorow wzgledem Shigley's, testy pytest / Vitest",
      },
      {
        label: "Bugfix przez prompt",
        detail: "Bug - ChatGPT - precyzyjny prompt naprawczy - poprawka w modelu kodujacym",
      },
    ],
  },

  // ─── 7. PODZIAL ROL ──────────────────────────────────────────────────────
  {
    id: 7,
    type: "comparison",
    badge: "Modele AI",
    title: "Podzial pracy",
    subtitle: "ChatGPT kontra modele kodujace",
    intro:
      "ChatGPT jest lepszy w rozumowaniu i syntezie. Modele kodujace - w precyzyjnej edycji pliku. Maly, dobrze okreslony kontekst = mniej bledow.",
    columns: [
      {
        heading: "ChatGPT - analityczny",
        items: [
          "Analiza domeny inzynierskiej",
          "Planowanie architektury",
          "Tworzenie promptow do kodu",
          "Generowanie promptow naprawczych",
          "Weryfikacja sensu wynikow",
        ],
      },
      {
        heading: "Claude Code / GPT - kodujacy",
        items: [
          "Generowanie kodu z gotowego promptu",
          "Edycja konkretnych plikow i funkcji",
          "Implementacja testow jednostkowych",
          "Refaktoryzacja z precyzyjnym kontekstem",
          "Male, jednoznaczne taski = mniej rinse",
        ],
      },
    ],
  },

  // ─── 8. PROMPT ENGINEERING - STRATEGIA ──────────────────────────────────
  {
    id: 8,
    type: "bullets",
    badge: "Prompty",
    title: "Prompt jako interfejs kontroli",
    subtitle: "Nie zadawanie pytan - projektowanie instrukcji",
    bullets: [
      {
        text: "Prompt nie byl prosba - byl specyfikacja zadania dla modelu.",
      },
      {
        text: "Trzy klasy promptow odpowiadaly trzem fazom pracy:",
        sub: [
          "Analityczny - rozumienie problemu i planowanie struktury",
          "Wykonawczy - implementacja jednej, dobrze opisanej funkcji",
          "Naprawczy - diagnoza bledu z dokladnym kontekstem i oczekiwanym zachowaniem",
        ],
      },
      {
        text: "Kazdy prompt ograniczal zakres modelu: jeden plik, jedna funkcja, bez skutkow ubocznych.",
      },
      {
        text: "Efekt: przewidywalny output, latwe code review, niski koszt iteracji.",
      },
    ],
  },

  // ─── 9. ANATOMIA: PROMPT ANALITYCZNY ────────────────────────────────────
  {
    id: 9,
    type: "prompt-anatomy",
    badge: "Prompty",
    title: "Prompt analityczny",
    subtitle: "Faza: rozumienie domeny i planowanie struktury",
    promptAnatomy: {
      kind: "analityczny",
      purpose: "Przeksztalcenie wymaganego zachowania systemu w plan techniczny — bez generowania kodu. Uzywany zanim powstal jakikolwiek plik.",
      when: "Przed startem nowego modulu lub endpointu. ChatGPT tworzyl ten prompt na podstawie opisu funkcjonalnego.",
      sections: [
        {
          label: "Opis problemu",
          value: "Co system ma robic — w jezyku domenowym, nie technicznym",
        },
        {
          label: "Kontekst",
          value: "Stack, framework, biblioteki — co juz istnieje",
        },
        {
          label: "Ograniczenia",
          value: "Czego nie robic: brak implementacji, brak importow, tylko sygnatury",
        },
        {
          label: "Oczekiwany rezultat",
          value: "Schemat modulu: nazwy funkcji, typy parametrow i wyjsc",
        },
      ],
      example: `# PROMPT ANALITYCZNY: planowanie fatigue_engine.py

Kontekst:
Buduję moduł obliczeniowy do analizy zmęczeniowej.
Backend: FastAPI + Python 3.11. Plik: fatigue_engine.py

Wymagane zachowanie:
- Korekcje Marin: ka, kb, kc, kd, ke, kf → Se
- Modele naprężenia średniego: Goodman, Gerber, Soderberg
- Dopasowanie S-N (Basquin): b, sigma_f_prime → N(sigma_a)
- Współczynnik bezpieczeństwa SF względem S_e i sigma_a

Ograniczenia:
- Zwróć wyłącznie sygnatury funkcji z typami
- Bez implementacji, bez importów, bez docstringów
- Każda funkcja osobno, bez klas

Oczekiwany format:
def calculate_modified_endurance_limit(...) -> float: ...
def apply_goodman(...) -> float: ...`,
    },
  },

  // ─── 10. ANATOMIA: PROMPT WYKONAWCZY ────────────────────────────────────
  {
    id: 10,
    type: "prompt-anatomy",
    badge: "Prompty",
    title: "Prompt wykonawczy",
    subtitle: "Faza: implementacja jednej, dobrze opisanej funkcji",
    promptAnatomy: {
      kind: "wykonawczy",
      purpose: "Wygenerowanie konkretnego kodu na podstawie sygnatury z etapu analitycznego. Jeden prompt = jedna funkcja lub jeden endpoint.",
      when: "Po zaakceptowaniu planu struktury. Claude Code lub GPT dostawaly ten prompt bezposrednio w VS Code.",
      sections: [
        {
          label: "Wskazanie pliku",
          value: "Dokladna sciezka — model nie domysla sie lokalizacji",
        },
        {
          label: "Sygnatura i typy",
          value: "Parametry, typy, zakres wartosci, jednostki fizyczne",
        },
        {
          label: "Wymagania brzegowe",
          value: "Walidacja wejscia, wyjatki, co robic przy blednych danych",
        },
        {
          label: "Zakaz modyfikacji",
          value: "Nie dotykaj innych funkcji w pliku — tylko ta jedna",
        },
      ],
      example: `# PROMPT WYKONAWCZY: implementacja funkcji Marin

Plik: backend/app/core/fatigue_engine.py

Zaimplementuj funkcję:
  calculate_modified_endurance_limit(
    Se_prime: float,
    ka: float, kb: float, kc: float,
    kd: float, ke: float, kf: float
  ) -> float

Opis parametrów:
  Se_prime  — przybliżona granica zmęczeniowa [MPa]
  ka...kf   — czynniki korekcyjne Marin, zakres (0, 1]

Logika:
  Se = ka * kb * kc * kd * ke * kf * Se_prime
  Jeśli Se <= 0: rzuć ValueError("Se must be positive")
  Zwróć Se zaokrąglone do 4 miejsc po przecinku

Ograniczenia:
  Bez dodatkowych importów
  Bez komentarzy inline
  Nie modyfikuj innych funkcji w pliku`,
    },
  },

  // ─── 11. ANATOMIA: PROMPT NAPRAWCZY ─────────────────────────────────────
  {
    id: 11,
    type: "prompt-anatomy",
    badge: "Prompty",
    title: "Prompt naprawczy",
    subtitle: "Faza: diagnoza i precyzyjna korekta bledu",
    promptAnatomy: {
      kind: "naprawczy",
      purpose: "Naprawienie konkretnego bledu bez naruszenia reszty kodu. ChatGPT analizowal traceback i tworzyl prompt — model kodujacy tylko aplikowal poprawke.",
      when: "Po nieudanym tescie lub bledzie runtime. Prompt powstawal z tracebacku + inspekcji funkcji.",
      sections: [
        {
          label: "Objaw bledu",
          value: "Dokładny komunikat, endpoint, traceback — co sie dzeje",
        },
        {
          label: "Kontekst lokalizacji",
          value: "Plik, funkcja, linia — gdzie szukac przyczyny",
        },
        {
          label: "Oczekiwane zachowanie",
          value: "Co powinno sie stac zamiast bledu",
        },
        {
          label: "Regresja",
          value: "Nie zmieniaj sygnatury — istniejace testy musza przejsc",
        },
      ],
      example: `# PROMPT NAPRAWCZY: blad walidacji Pydantic

Objaw:
POST /api/analyze/compare zwraca 422 Unprocessable Entity
Traceback: pydantic.ValidationError — value is not a valid float
Pole: sigma_max w odpowiedzi Groq API

Przyczyna:
Groq zwraca {"sigma_max": "320 MPa"} zamiast {"sigma_max": 320.0}
JSON Schema response mode nie wymusił typu float

Lokalizacja:
  plik:    backend/app/services/groq_client.py
  funkcja: parse_groq_response(raw: dict) -> FatigueResult

Zadanie:
Dodaj parsowanie string → float dla pól:
  sigma_max, sigma_min, safety_factor, cycles_to_failure
Obsłuż formaty wejściowe: "320 MPa", "320.0", "3.2e4"
Użyj re.sub do usunięcia jednostek przed float()

Ograniczenia:
  Nie zmieniaj sygnatury parse_groq_response
  Testy test_groq_client.py muszą przejść bez zmian`,
    },
  },

  // ─── 12. PRZYKLAD: PROMPT PLANUJACY ─────────────────────────────────────
  {
    id: 12,
    type: "prompt",
    badge: "Prompty",
    title: "Przyklad: prompt planujacy",
    subtitle: "Tworzony przez ChatGPT przed generowaniem kodu",
    prompt: {
      label: "PROMPT ANALITYCZNY / PLANUJACY",
      variant: "neutral",
      code: `Kontekst:
Buduje aplikacje do analizy zmeczeniowej.
Backend: FastAPI + Python. Frontend: Next.js.
Silnik musi implementowac:
  - korekcje Marin (ka, kb, kc, kd, ke, kf)
  - zmodyfikowana granice zmeczeniowa Se
  - modele naprezenia sredniego: Goodman, Gerber, Soderberg
  - dopasowanie S-N metoda Basquina
  - obliczenie N i wspolczynnika bezpieczenstwa SF

Zadanie:
Zaplanuj strukture modulu fatigue_engine.py.
Zdefiniuj sygnatury funkcji, typy parametrow i wyjsc.
Zwroc wylacznie schemat - bez implementacji.`,
    },
  },

  // ─── 13. PRZYKLAD: PROMPT WYKONAWCZY ────────────────────────────────────
  {
    id: 13,
    type: "prompt",
    badge: "Prompty",
    title: "Przyklad: prompt implementacyjny",
    subtitle: "Do Claude Code - precyzyjne zadanie kodowe",
    prompt: {
      label: "PROMPT WYKONAWCZY",
      variant: "neutral",
      code: `Plik: backend/app/core/fatigue_engine.py

Zaimplementuj funkcje:
  calculate_modified_endurance_limit(
    Se_prime, ka, kb, kc, kd, ke, kf
  )

Parametry:
  Se_prime: float - przyblizana granica zmeczeniowa [MPa]
  ka...kf:  float - czynniki korekcyjne Marin, zakres (0, 1]

Wymagania:
  Se = ka * kb * kc * kd * ke * kf * Se_prime
  Jesli Se <= 0, rzuc ValueError z komunikatem
  Bez dodatkowych importow, bez komentarzy
  Nie modyfikuj innych funkcji w pliku`,
    },
  },

  // ─── 14. PRZYKLAD: PROMPT NAPRAWCZY ─────────────────────────────────────
  {
    id: 14,
    type: "prompt",
    badge: "Prompty",
    title: "Przyklad: prompt naprawczy",
    subtitle: "Precyzyjny opis bledu - precyzyjna poprawka",
    prompt: {
      label: "PROMPT BUGFIX",
      variant: "warning",
      code: `Problem:
POST /api/analyze/compare - Groq API zwraca naprezenie
jako string ("320 MPa") zamiast float (320.0).
Blad Pydantic: "value is not a valid float"

Kontekst:
  plik:    backend/app/services/groq_client.py
  funkcja: parse_groq_response()
  pole:    "sigma_max": "320 MPa"

Zadanie:
Dodaj parsowanie string -> float w parse_groq_response()
dla pol: sigma_max, sigma_min, safety_factor, cycles_to_failure.
Obsluz formaty: "320 MPa", "320.0", "3.2e4".
Nie zmieniaj sygnatury funkcji.`,
    },
  },

  // ─── 15. PROBLEMY ────────────────────────────────────────────────────────
  {
    id: 15,
    type: "bullets",
    badge: "Problemy",
    title: "Napotkane problemy",
    subtitle: "Bugi, niespojnosci, ograniczenia modeli",
    bullets: [
      {
        text: "Niespojnosc typow: AI vs Pydantic",
        sub: [
          "LLM zwracal wartosci jako string z jednostka: '320 MPa'",
          "Rozwiazanie: JSON Schema response mode + fallback json_object",
        ],
      },
      {
        text: "Bugi wizualizacji - S-N i Goodman",
        sub: ["Niepoprawne skalowanie logarytmiczne przy ekstremalnych wartosciach"],
      },
      {
        text: "Poprawnosc inzynierska",
        sub: [
          "Kod syntaktycznie poprawny, ale bledna logika S-N w obszarze plastycznym",
          "Koniecznosc weryfikacji wzgledem Shigley's Mechanical Engineering Design",
        ],
      },
      {
        text: "Kontrola kontekstu",
        sub: [
          "Zbyt duzy kontekst - model modyfikował nie te pliki",
          "Rozwiazanie: jeden plik / jedna funkcja na prompt",
        ],
      },
    ],
  },

  // ─── 16. AKTUALNY STAN ───────────────────────────────────────────────────
  {
    id: 16,
    type: "status",
    badge: "Stan",
    title: "Stan aplikacji",
    subtitle: "Gotowe komponenty i pokrycie testami",
    statusDone: [
      "Silnik obliczen - Marin, Goodman / Gerber / Soderberg / Morrow, Basquin, Miner",
      "API REST - /analyze, /analyze/compare, /analyze/interpret",
      "Vision endpoint - odczyt naprezen ze screenshotow MES",
      "Wykresy - krzywa S-N z punktem roboczym, diagram Goodmana",
      "Baza materialow - AISI 1020, AISI 4340, Al 7075-T6, Ti-6Al-4V",
      "Interpretacja AI - Groq /interpret, tekstowe podsumowanie wynikow",
      "Testy - pytest 1 523 linii (backend), Vitest 9 plikow (frontend)",
    ],
    statusPending: [
      "Pelna integracja AI comparison w UI",
      "Tryb Miner - akumulacja uszkodzen dla wielu blokow obciazen",
    ],
  },

  // ─── 17. WNIOSKI ─────────────────────────────────────────────────────────
  {
    id: 17,
    type: "conclusions",
    badge: "Wnioski",
    title: "Wnioski",
    subtitle: "Refleksja inzynierska i developerska",
    conclusions: [
      {
        heading: "AI przyspiesza, ale nie zastepuje inzyniera",
        body: "Boilerplate i testy powstaja szybko. Wybor modelu obliczeniowego, weryfikacja wzorow i interpretacja wynikow — to nadal zadanie czlowieka.",
      },
      {
        heading: "Prompt engineering to umiejetnosc techniczna",
        body: "Podzial na prompt analityczny i wykonawczy byl swiadoma decyzja. Mniejszy, precyzyjny kontekst = mniej bledow, mniej iteracji.",
      },
      {
        heading: "Weryfikacja jest niezbedna",
        body: "Kod AI moze byc syntaktycznie poprawny i inzyniersko bledny. Kazdy wynik wymagal sprawdzenia wzgledem literatury.",
      },
      {
        heading: "Co zrobic inaczej",
        body: "Wczesniej zdefiniowac JSON Schema dla odpowiedzi AI. Automatyczne testy regresyjne od pierwszego sprintu.",
      },
    ],
  },
];
