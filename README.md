# DysLex Shield

DysLex Shield is a child-friendly reading adventure that uses camera-based eye tracking to help explore reading behavior. Children follow Lumi through a short forest story, while the browser can capture gaze data, extract reading features, and optionally stream a live session to a backend over an authenticated STOMP WebSocket connection.

The experience is designed to feel like a game rather than a test. Results are screening signals for adults and are not a medical diagnosis.

## What it does

- Provides email/password registration and login.
- Guides a child through a profile and adventure welcome flow.
- Loads a TensorFlow.js MediaPipe Face Mesh detector in the browser.
- Requests camera access and shows a live camera preview during calibration and reading.
- Offers a demo mode that skips camera use for development and demonstrations.
- Calibrates gaze against five on-screen stars.
- Runs the `Lumi's Forest Adventure` reading activity.
- Includes Word Hunt, Syllable Pop, and Story Grove stages.
- Tracks gaze points, face-detection confidence, reading events, speech captures, and session metadata.
- Smooths and processes gaze data locally, including fixation, saccade, regression, word-mapping, and quality analysis utilities.
- Optionally sends session and gaze data to a backend through STOMP over SockJS.
- Shows a child-friendly completion screen and lets an adult export analysis or raw session JSON.

## User flow

1. A signed-in user selects or creates a local explorer profile.
2. The app loads the face-landmark model and starts the camera.
3. The user can retry camera initialization or choose Demo Mode.
4. Lumi guides the child through five-point gaze calibration.
5. The child completes the reading adventure and its enabled mini-game stages.
6. The session ends after the adventure timer finishes, and local analysis is calculated.
7. The completion screen offers Play Again, Grown-up Results, and Raw Data exports.

The application routes are:

| Route | Access | Purpose |
| --- | --- | --- |
| `/login` | Public | Sign in with an email and password |
| `/register` | Public | Create an account |
| `/` | Authenticated | Profile selection and reading adventure |
| `/design-system` | Public | Internal design-system preview |
| `*` | Public | Not-found page |

## Quick start

### Prerequisites

- Node.js 18 or newer is recommended.
- npm or Bun.
- A modern browser with camera support for real tracking.
- A compatible authentication/API backend for account creation and login.
- A STOMP gaze backend only if live server streaming is required.

### Install and run

```bash
npm install
npm run dev
```

The Vite development server uses port `8080` by default. Open [http://localhost:8080](http://localhost:8080).

The repository also includes `bun.lockb`, so Bun can be used instead:

```bash
bun install
bun run dev
```

### Demo mode

Demo Mode is available from the loading screen. It disables camera-based capture and uses the adventure UI without sending synthetic gaze data to the backend. Use it to verify navigation, styling, and the game flow without camera permissions or a working ML service.

## Configuration

Create a `.env.local` file in the project root when the API and WebSocket services are not available at the same origin:

```dotenv
VITE_API_URL=http://localhost:8091
VITE_WS_URL=http://localhost:8091/ws/gaze
```

Only these two variables are read by the application:

| Variable | Default | Used for |
| --- | --- | --- |
| `VITE_API_URL` | Empty string | Axios authentication requests and token refresh |
| `VITE_WS_URL` | `/ws/gaze` | SockJS/STOMP connection |

When the variables are omitted, the browser uses same-origin API and WebSocket paths. During development, Vite proxies `/api` and `/ws` to `http://localhost:8091` as configured in `vite.config.ts`.

For production, use HTTPS and WSS endpoints, for example:

```dotenv
VITE_API_URL=https://api.example.com
VITE_WS_URL=https://api.example.com/ws/gaze
```

Do not put passwords, private keys, or long-lived secrets in Vite environment variables. Values prefixed with `VITE_` are bundled into browser code.

## Backend contract

The frontend authentication service expects these REST endpoints relative to `VITE_API_URL`:

| Method | Endpoint | Payload / behavior |
| --- | --- | --- |
| `POST` | `/api/auth/login` | `{ email, password }`; returns access token, refresh token, role, and expiry |
| `POST` | `/api/auth/register` | `{ username, email, password, dateOfBirth, gender }` |
| `POST` | `/api/auth/refresh` | `{ refreshToken }`; returns refreshed tokens |

The client stores tokens in memory first and mirrors them to `localStorage` under `auth_tokens`. Authenticated Axios requests receive a Bearer token. A `401` response triggers one refresh attempt; failed refresh clears the stored tokens and returns the user to login.

### STOMP connection

The client connects to `VITE_WS_URL` using SockJS and sends the JWT in STOMP connection headers. It uses 10-second incoming and outgoing heartbeats and retries disconnected connections with exponential backoff, up to ten attempts.

The session lifecycle is:

```text
connect
	-> /app/gaze.session.start
	-> /app/gaze.frame (streamed gaze points)
	-> /app/gaze.feature (detected features, when published)
	-> /app/gaze.session.end
```

The default server destinations are:

| Direction | Destination | Purpose |
| --- | --- | --- |
| Client to server | `/app/gaze.session.start` | Start a session with session ID, task ID, and metadata |
| Client to server | `/app/gaze.frame` | Publish gaze coordinates, confidence, velocity, and head rotation |
| Client to server | `/app/gaze.feature` | Publish fixation, saccade, blink, or smooth-pursuit events |
| Client to server | `/app/gaze.session.end` | End the session with counts, duration, and summary metrics |
| Server to client | `/user/queue/ack` | Acknowledge received, rate-limited, dropped, or failed frames |
| Server to client | `/user/queue/result` | Return an ML result and optional feature breakdown |
| Server to client | `/user/queue/errors` | Return warning, error, or fatal messages |

The TypeScript DTOs for this contract live in [src/api/types.ts](src/api/types.ts). The client requires the WebSocket to be connected before starting a server-backed session.

## Architecture

```text
React Router and AuthGuard
							|
			 Index page state machine
							|
Profile -> Welcome -> Loading -> Calibration -> Adventure -> Summary
																			|
												 TensorFlow.js Face Mesh
																			|
										gaze processing and feature extraction
												 /                         \
							 local analysis                  STOMP stream
												 |                         |
						 JSON export in browser       authenticated backend/ML service
```

### Frontend layers

- `src/App.tsx`: providers, routes, and authentication boundary.
- `src/pages/`: login, registration, protected adventure entry, design-system preview, and not-found views.
- `src/components/`: child-facing adventure screens, camera preview, calibration, game stages, completion UI, quality views, and STOMP diagnostics.
- `src/hooks/`: camera/Face Mesh capture, smoothing, gaze processing, speech capture, streaming, connection management, and server-response handling.
- `src/api/`: auth requests, token refresh, STOMP client, session lifecycle, result parsing, and result history.
- `src/store/`: Zustand state for connection status, active session, stream metrics, ML results, and debug counters.
- `src/lib/`: feature extraction, gaze processing, typography preferences, and shared utilities.
- `src/adventure/`: adventure event and profile models, plus local explorer profile persistence.
- `src/miniGames/`: reusable mini-game logic and types.
- `src/types/`: gaze and session data contracts.

### Gaze and analysis pipeline

The browser-side pipeline is intended to keep raw camera processing local:

1. TensorFlow.js Face Mesh detects facial landmarks and iris-related gaze coordinates.
2. The tracking hooks produce timestamped gaze points with confidence and face state.
3. Processing utilities can smooth points, normalize head movement, interpolate gaps, reject outliers, and estimate velocity.
4. Feature extraction identifies fixations, saccades, regressions, reading pace, word mapping, and quality metrics.
5. `EndScreen` runs the full local analysis and creates downloadable JSON exports.
6. When configured, the streaming hooks publish selected data to the STOMP backend for server-side processing and results.

## Privacy and data handling

- Camera frames are used by the browser-side TensorFlow.js detector; the application does not upload camera images.
- Local explorer profiles are stored in browser `localStorage` under `dyslex-shield-explorer-profiles`.
- Auth tokens are held in memory and also mirrored to `localStorage` for session recovery.
- Raw gaze and analysis exports are generated as downloads in the browser.
- If a backend is configured, gaze/session payloads are sent to that backend. Review and configure backend retention, access control, consent, and transport security before deployment.
- The application should be presented as an exploratory screening aid, not as a diagnosis or a replacement for a qualified professional.

## Development commands

```bash
npm run dev          # Start Vite in development mode
npm run build        # Create a production build in dist/
npm run build:dev    # Build using Vite's development mode
npm run preview      # Serve the production build locally
npm run lint         # Run ESLint
npm run test         # Run the Vitest suite once
npm run test:watch   # Run Vitest in watch mode
```

The current automated test suite contains a smoke test in [src/test/example.test.ts](src/test/example.test.ts). Manual browser testing remains important for camera permissions, model loading, calibration, WebSocket reconnection, and export behavior.

## Troubleshooting

### Camera or model loading fails

- Use HTTPS or `localhost`; browsers commonly block camera access on insecure origins.
- Allow camera access for the site and reload.
- Use front-facing, even lighting and keep the face visible.
- Check the browser console for TensorFlow.js model-loading errors.
- Choose Demo Mode to confirm that the rest of the application works without camera access.

### Login or registration fails

- Confirm the backend is running and that `VITE_API_URL` is correct.
- With no `VITE_API_URL`, confirm the Vite `/api` proxy can reach `localhost:8091`.
- Inspect the Network tab for `/api/auth/login`, `/api/auth/register`, or `/api/auth/refresh` responses.

### WebSocket does not connect

- Confirm the backend exposes a SockJS endpoint at `/ws/gaze` or set `VITE_WS_URL` to the correct endpoint.
- Confirm the backend accepts the JWT and STOMP headers sent by [src/api/wsClient.ts](src/api/wsClient.ts).
- Check that the browser is using HTTPS with an HTTPS/WSS-compatible backend in production.
- Use the connection and debug components or browser console logs to inspect reconnect attempts and dropped frames.

### Results are sparse or low quality

- Keep the face centered and visible throughout the session.
- Improve lighting and reduce strong backlighting.
- Complete calibration before starting the reading activity.
- Remember that Demo Mode intentionally does not generate synthetic gaze data for the backend.

## Documentation map

The repository contains detailed implementation notes in addition to this overview:

- [DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md): index of the STOMP and gaze documentation.
- [STOMP_SUMMARY.md](STOMP_SUMMARY.md): STOMP architecture overview.
- [STOMP_SETUP.md](STOMP_SETUP.md): backend integration and configuration notes.
- [STOMP_API_REFERENCE.md](STOMP_API_REFERENCE.md): client APIs, DTOs, and message examples.
- [STOMP_DATA_FLOW.md](STOMP_DATA_FLOW.md): message-flow diagrams.
- [STOMP_RECIPES.md](STOMP_RECIPES.md): integration patterns and examples.
- [STOMP_DEPLOYMENT.md](STOMP_DEPLOYMENT.md): deployment and operational checklist.
- [ML_RESULT_PIPELINE_GUIDE.md](ML_RESULT_PIPELINE_GUIDE.md): result parsing, validation, history, and UI update pipeline.
- [PRODUCTION_PIPELINE_ARCHITECTURE.md](PRODUCTION_PIPELINE_ARCHITECTURE.md): staged gaze-processing architecture.
- [src/docs/GAZE_TRACKING_GUIDE.md](src/docs/GAZE_TRACKING_GUIDE.md): smoothing, fixation, saccade, word mapping, and validation utilities.
- [QUICK_START.md](QUICK_START.md): example integration for the gaze-processing hooks.
- [NEXT_STEPS_CHECKLIST.md](NEXT_STEPS_CHECKLIST.md): integration and tuning work tracked by the project.

Some older STOMP documents use `REACT_APP_*` examples and legacy `src/components` layouts. For this Vite application, use `VITE_API_URL`, `VITE_WS_URL`, and the source paths in the current repository.

## Project status

This repository contains a working Vite/React frontend and the client-side pieces needed to connect it to a compatible authentication and gaze/ML backend. Backend services, model quality, clinical validation, consent workflows, and production data governance are outside this repository and must be supplied and verified separately.
