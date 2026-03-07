-- =============================================================================
-- AIRPORT COMPANION — SCHEMA v3 (FLOORLESS / SINGLE-PLANE)
-- PostgreSQL 14+  |  No PostGIS  |  No partitioning  |  No floors
--
-- All positions are X/Y metres in a single flat coordinate system per airport.
-- Origin = SW corner of the airport floor plan image.
-- X = east (+)   Y = north (+)
-- px_per_metre on the airport row converts between image pixels and metres.
--
-- Modules:
--   1. Airport & Spatial     — airport, zones, poi_categories, pois
--   2. Navigation Graph      — nav_nodes, nav_edges
--   3. Dead Reckoning (IMU)  — dr_sessions, imu_readings, step_events, position_estimates
--   4. Replay Engine         — replay_tracks
--   5. Digital Identity      — users, biometric_profiles, travel_documents,
--                               verification_tokens, consent_records
--   6. Touchpoints & Events  — touchpoints, verification_events
--   7. Accessibility         — accessibility_profiles, haptic_patterns, audio_cues
--   8. Flights               — flights, flight_subscriptions
--   9. Notifications         — notification_queue
--  10. Views & Functions
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid(), digest()

-- =============================================================================
-- 1. AIRPORT & SPATIAL
-- =============================================================================

CREATE TABLE airports (
    id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    iata_code       CHAR(3) NOT NULL UNIQUE,
    icao_code       CHAR(4) UNIQUE,
    name            TEXT    NOT NULL,
    city            TEXT    NOT NULL,
    country_code    CHAR(2) NOT NULL,
    timezone        TEXT    NOT NULL DEFAULT 'UTC',
    -- Floor plan calibration (single plane)
    floor_plan_url  TEXT    NOT NULL DEFAULT '/assets/floorplan.svg',
    px_per_metre    REAL    NOT NULL DEFAULT 10,
    width_m         REAL    NOT NULL DEFAULT 400,
    height_m        REAL    NOT NULL DEFAULT 200,
    metadata        JSONB   NOT NULL DEFAULT '{}'
);

CREATE TABLE zones (
    id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    airport_id  UUID    NOT NULL REFERENCES airports(id) ON DELETE CASCADE,
    name        TEXT    NOT NULL,
    zone_type   TEXT    NOT NULL
                CHECK (zone_type IN (
                    'public','pre_security','post_security','gate_area',
                    'lounge','retail','food_and_beverage','baggage',
                    'transit','staff_only','emergency'
                )),
    -- Axis-aligned bounding box in metres
    x_min_m     REAL    NOT NULL,
    y_min_m     REAL    NOT NULL,
    x_max_m     REAL    NOT NULL,
    y_max_m     REAL    NOT NULL,
    is_accessible   BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX idx_zones_airport ON zones(airport_id);

CREATE TABLE poi_categories (
    id      SMALLSERIAL PRIMARY KEY,
    slug    TEXT    NOT NULL UNIQUE,
    label   TEXT    NOT NULL,
    icon    TEXT
);

INSERT INTO poi_categories (slug, label, icon) VALUES
    ('gate',          'Gate',                 'icon-gate'),
    ('checkin',       'Check-in Desk',        'icon-checkin'),
    ('security',      'Security',             'icon-security'),
    ('passport',      'Passport Control',     'icon-passport'),
    ('baggage',       'Baggage Claim',        'icon-baggage'),
    ('restroom',      'Restroom',             'icon-restroom'),
    ('elevator',      'Elevator',             'icon-elevator'),
    ('escalator',     'Escalator',            'icon-escalator'),
    ('stairs',        'Stairs',               'icon-stairs'),
    ('lounge',        'Lounge',               'icon-lounge'),
    ('food',          'Food & Beverage',      'icon-food'),
    ('retail',        'Retail',               'icon-retail'),
    ('charging',      'Charging Station',     'icon-charging'),
    ('medical',       'Medical Center',       'icon-medical'),
    ('info',          'Information Desk',     'icon-info'),
    ('prayer',        'Prayer Room',          'icon-prayer'),
    ('play_area',     'Play Area',            'icon-play'),
    ('taxi',          'Taxi / Rideshare',     'icon-taxi'),
    ('train',         'Train / AirTrain',     'icon-train'),
    ('exit',          'Exit',                 'icon-exit'),
    ('emergency_exit','Emergency Exit',       'icon-emergency');

CREATE TABLE pois (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    airport_id      UUID        NOT NULL REFERENCES airports(id) ON DELETE CASCADE,
    zone_id         UUID        REFERENCES zones(id),
    category_id     SMALLINT    NOT NULL REFERENCES poi_categories(id),
    name            TEXT        NOT NULL,
    description     TEXT,
    x_m             REAL        NOT NULL,
    y_m             REAL        NOT NULL,
    entrance_x_m    REAL,               -- nav node snaps here
    entrance_y_m    REAL,
    gate_number     TEXT,
    airline_codes   TEXT[],             -- NULL = all airlines
    -- Accessibility
    is_accessible           BOOLEAN NOT NULL DEFAULT TRUE,
    has_tactile_path        BOOLEAN NOT NULL DEFAULT FALSE,
    has_hearing_loop        BOOLEAN NOT NULL DEFAULT FALSE,
    has_braille_signage     BOOLEAN NOT NULL DEFAULT FALSE,
    -- Accessibility cues
    tts_label       TEXT,
    haptic_cue      TEXT
                    CHECK (haptic_cue IN (
                        'turn_left','turn_right','continue_straight',
                        'destination_near','destination_reached',
                        'obstacle_ahead','security_checkpoint',NULL
                    )),
    operating_hours JSONB,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pois_airport_cat ON pois(airport_id, category_id);
CREATE INDEX idx_pois_gate        ON pois(gate_number) WHERE gate_number IS NOT NULL;


-- =============================================================================
-- 2. NAVIGATION GRAPH
-- =============================================================================

CREATE TABLE nav_nodes (
    id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    airport_id      UUID    NOT NULL REFERENCES airports(id) ON DELETE CASCADE,
    poi_id          UUID    REFERENCES pois(id),
    x_m             REAL    NOT NULL,
    y_m             REAL    NOT NULL,
    node_type       TEXT    NOT NULL DEFAULT 'waypoint'
                    CHECK (node_type IN ('waypoint','poi_entrance','security')),
    is_accessible   BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX idx_nodes_airport ON nav_nodes(airport_id);

CREATE TABLE nav_edges (
    id                  UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    from_node_id        UUID    NOT NULL REFERENCES nav_nodes(id) ON DELETE CASCADE,
    to_node_id          UUID    NOT NULL REFERENCES nav_nodes(id) ON DELETE CASCADE,
    distance_m          REAL    NOT NULL,
    travel_time_s       SMALLINT,
    edge_type           TEXT    NOT NULL DEFAULT 'walkway'
                        CHECK (edge_type IN (
                            'walkway','moving_walkway','stairs','escalator'
                        )),
    is_accessible       BOOLEAN NOT NULL DEFAULT TRUE,
    is_bidirectional    BOOLEAN NOT NULL DEFAULT TRUE,
    crowding_factor     REAL    NOT NULL DEFAULT 1.0 CHECK (crowding_factor > 0),
    crowding_updated_at TIMESTAMPTZ
);
CREATE INDEX idx_edges_from ON nav_edges(from_node_id);
CREATE INDEX idx_edges_to   ON nav_edges(to_node_id);


-- =============================================================================
-- 3. DEAD RECKONING — IMU PIPELINE
-- =============================================================================

CREATE TABLE dr_sessions (
    id                      UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID,               -- FK wired after users table
    device_key              TEXT    NOT NULL,
    airport_id              UUID    NOT NULL REFERENCES airports(id),
    -- Confirmed start position
    start_x_m               REAL    NOT NULL,
    start_y_m               REAL    NOT NULL,
    start_confirmed_by      TEXT    NOT NULL DEFAULT 'manual'
                            CHECK (start_confirmed_by IN ('manual','manual_set','nfc_tag','qr_code','replay')),
    -- Destination
    destination_poi_id      UUID    REFERENCES pois(id),
    destination_node_id     UUID    REFERENCES nav_nodes(id),
    -- Routing
    route_mode              TEXT    NOT NULL DEFAULT 'fastest'
                            CHECK (route_mode IN ('fastest','accessible','least_crowded')),
    nav_mode                TEXT    NOT NULL DEFAULT 'standard'
                            CHECK (nav_mode IN (
                                'standard','low_vision','blind',
                                'deaf','deaf_blind','wheelchair'
                            )),
    ar_enabled              BOOLEAN NOT NULL DEFAULT TRUE,
    -- State
    status                  TEXT    NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active','completed','abandoned','rerouted')),
    started_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at                TIMESTAMPTZ,
    replay_track_id         UUID,               -- FK wired after replay_tracks
    -- Completion stats
    total_distance_m        REAL,
    total_steps             INT,
    max_drift_m             REAL
);
CREATE INDEX idx_dr_sessions_user    ON dr_sessions(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_dr_sessions_airport ON dr_sessions(airport_id, started_at DESC);

-- Raw IMU batch (~100 ms cadence)
CREATE TABLE imu_readings (
    id              BIGSERIAL   PRIMARY KEY,
    session_id      UUID        NOT NULL REFERENCES dr_sessions(id) ON DELETE CASCADE,
    recorded_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Accelerometer (m/s², device frame)
    accel_x         REAL,
    accel_y         REAL,
    accel_z         REAL,
    -- Gyroscope (rad/s, device frame)
    gyro_x          REAL,
    gyro_y          REAL,
    gyro_z          REAL,
    -- Magnetometer (µT, world frame, post hard-iron correction)
    mag_x           REAL,
    mag_y           REAL,
    mag_z           REAL,
    -- Fused orientation quaternion (device sensor fusion)
    quat_w          REAL,
    quat_x          REAL,
    quat_y          REAL,
    quat_z          REAL,
    -- Convenience yaw (0=North, clockwise+)
    heading_deg     REAL
);
CREATE INDEX idx_imu_session ON imu_readings(session_id, recorded_at DESC);

-- One row per detected footstep
CREATE TABLE step_events (
    id              BIGSERIAL   PRIMARY KEY,
    session_id      UUID        NOT NULL REFERENCES dr_sessions(id) ON DELETE CASCADE,
    detected_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    heading_deg     REAL        NOT NULL,
    stride_length_m REAL        NOT NULL DEFAULT 0.75,
    -- Pre-computed displacement (app writes before INSERT)
    delta_x_m       REAL        NOT NULL,   -- stride * sin(radians(heading))
    delta_y_m       REAL        NOT NULL,   -- stride * cos(radians(heading))
    step_number     INT         NOT NULL,
    cadence_spm     REAL,
    activity        TEXT        CHECK (activity IN ('walking','running','stopped',NULL))
);
CREATE INDEX idx_steps_session ON step_events(session_id, step_number DESC);

-- Authoritative position: what the map + AR layer consume
CREATE TABLE position_estimates (
    id              BIGSERIAL   PRIMARY KEY,
    session_id      UUID        NOT NULL REFERENCES dr_sessions(id) ON DELETE CASCADE,
    estimated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    x_m             REAL        NOT NULL,
    y_m             REAL        NOT NULL,
    heading_deg     REAL        NOT NULL,
    drift_radius_m  REAL        NOT NULL DEFAULT 0.0,
    map_matched     BOOLEAN     NOT NULL DEFAULT FALSE,
    snapped_node_id UUID        REFERENCES nav_nodes(id),
    source          TEXT        NOT NULL DEFAULT 'dead_reckoning'
                    CHECK (source IN (
                        'manual_set','qr_code','nfc_tag',
                        'dead_reckoning','map_matched','replay'
                    ))
);
CREATE INDEX idx_pos_session ON position_estimates(session_id, estimated_at DESC);


-- =============================================================================
-- 4. REPLAY ENGINE
-- =============================================================================

CREATE TABLE replay_tracks (
    id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    airport_id      UUID    NOT NULL REFERENCES airports(id),
    name            TEXT    NOT NULL,
    description     TEXT,
    -- JSON array: [{x_m, y_m, heading_deg, drift_radius_m, elapsed_ms}, ...]
    track_data      JSONB   NOT NULL,
    total_steps     INT,
    duration_ms     INT,
    poi_sequence    UUID[], -- Ordered POI ids the track passes through
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE dr_sessions
    ADD CONSTRAINT fk_session_replay
    FOREIGN KEY (replay_track_id) REFERENCES replay_tracks(id);


-- =============================================================================
-- 5. DIGITAL IDENTITY
-- =============================================================================

CREATE TABLE users (
    id                  UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    external_auth_id    TEXT    UNIQUE,
    auth_provider       TEXT    CHECK (auth_provider IN (
                            'local','apple','google','microsoft','airline_sso'
                        )),
    -- Credentials for local auth
    username            TEXT    UNIQUE,
    password_hash       TEXT,               -- bcrypt via passlib
    -- Contact: hashed — no plaintext PII
    email_hash          BYTEA   UNIQUE,     -- digest(lower(email), 'sha256')
    phone_hash          BYTEA,
    -- Profile
    display_name        TEXT,
    preferred_language  CHAR(5) NOT NULL DEFAULT 'en',
    nationality_code    CHAR(2),
    -- State
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    is_verified         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at        TIMESTAMPTZ,
    gdpr_consent_at     TIMESTAMPTZ,
    deletion_requested_at TIMESTAMPTZ
);
CREATE INDEX idx_users_username ON users(username) WHERE username IS NOT NULL;

ALTER TABLE dr_sessions
    ADD CONSTRAINT fk_dr_session_user
    FOREIGN KEY (user_id) REFERENCES users(id);

-- Biometric enrollment
-- face-api.js runs entirely on-device. The 128-float face descriptor
-- is computed in the browser, sent here for storage.
-- Matching also runs in-browser by loading this descriptor and calling
-- faceapi.euclideanDistance(). Server never processes raw biometrics.
CREATE TABLE biometric_profiles (
    id                  UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    modality            TEXT    NOT NULL DEFAULT 'face'
                        CHECK (modality IN ('face','fingerprint')),
    -- 128-element float array from face-api.js FaceRecognitionNet
    -- Stored as JSONB array. Matching is purely client-side.
    face_descriptor     JSONB,              -- [0.123, -0.456, ...] × 128
    -- Capture metadata
    quality_score       REAL    CHECK (quality_score BETWEEN 0 AND 1),
    liveness_score      REAL    CHECK (liveness_score BETWEEN 0 AND 1),
    enrolled_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    enrolled_device     TEXT,
    is_primary          BOOLEAN NOT NULL DEFAULT FALSE,
    is_revoked          BOOLEAN NOT NULL DEFAULT FALSE,
    revoked_at          TIMESTAMPTZ,
    expires_at          TIMESTAMPTZ
);
CREATE INDEX idx_bio_user ON biometric_profiles(user_id) WHERE NOT is_revoked;

-- Travel documents — sensitive fields encrypted at app layer (AES-256-GCM)
CREATE TABLE travel_documents (
    id                  UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    document_type       TEXT    NOT NULL
                        CHECK (document_type IN (
                            'passport','national_id','residence_permit','visa','crew_id'
                        )),
    -- AES-256-GCM encrypted (base64(iv + ciphertext + tag)), key from env
    document_number_enc TEXT    NOT NULL,
    surname_enc         TEXT    NOT NULL,
    given_names_enc     TEXT    NOT NULL,
    dob_enc             TEXT    NOT NULL,
    -- Plaintext (non-sensitive)
    nationality_code    CHAR(2) NOT NULL,
    issuing_country     CHAR(2) NOT NULL,
    expiry_date         DATE    NOT NULL,
    verified_by         TEXT    CHECK (verified_by IN ('nfc_chip','ocr','manual',NULL)),
    verified_at         TIMESTAMPTZ,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_docs_user ON travel_documents(user_id) WHERE is_active;

-- Verify-once token — issued after on-device biometric + document check
CREATE TABLE verification_tokens (
    id                      UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    biometric_profile_id    UUID    REFERENCES biometric_profiles(id),
    travel_document_id      UUID    REFERENCES travel_documents(id),
    -- SHA-256 of the raw JWT; only the JWT (issued to client) carries the real value
    token_hash              BYTEA   NOT NULL UNIQUE,
    -- Scoped claims: {age_verified, nationality_verified, ticket_valid,
    --                  flight_number, gate, boarding_group}
    claims                  JSONB   NOT NULL DEFAULT '{}',
    assurance_level         TEXT    NOT NULL DEFAULT 'ial2'
                            CHECK (assurance_level IN ('ial1','ial2','ial3')),
    issued_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at              TIMESTAMPTZ NOT NULL,
    is_revoked              BOOLEAN NOT NULL DEFAULT FALSE,
    revoked_at              TIMESTAMPTZ,
    revoked_reason          TEXT
);
CREATE INDEX idx_vt_user   ON verification_tokens(user_id, expires_at DESC);
CREATE INDEX idx_vt_active ON verification_tokens(token_hash) WHERE NOT is_revoked;

CREATE TABLE consent_records (
    id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    consent_type    TEXT    NOT NULL
                    CHECK (consent_type IN (
                        'biometric_enroll','location_tracking',
                        'data_processing','marketing','data_sharing_airline'
                    )),
    given           BOOLEAN NOT NULL,
    given_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    withdrawn_at    TIMESTAMPTZ,
    ip_hash         BYTEA
);
CREATE INDEX idx_consent_user ON consent_records(user_id, consent_type);


-- =============================================================================
-- 6. TOUCHPOINTS & VERIFICATION EVENTS
-- =============================================================================

CREATE TABLE touchpoints (
    id                  UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    airport_id          UUID    NOT NULL REFERENCES airports(id),
    poi_id              UUID    REFERENCES pois(id),
    name                TEXT    NOT NULL,
    touchpoint_type     TEXT    NOT NULL
                        CHECK (touchpoint_type IN (
                            'checkin_kiosk','bag_drop','security_lane',
                            'passport_control','boarding_gate',
                            'lounge_entry','customs','crew_access'
                        )),
    required_claims     TEXT[]  NOT NULL DEFAULT '{}',
    required_assurance  TEXT    NOT NULL DEFAULT 'ial2',
    is_active           BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX idx_touchpoints_airport ON touchpoints(airport_id);

-- Immutable log of every token use
CREATE TABLE verification_events (
    id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    token_id        UUID    NOT NULL REFERENCES verification_tokens(id),
    touchpoint_id   UUID    NOT NULL REFERENCES touchpoints(id),
    outcome         TEXT    NOT NULL
                    CHECK (outcome IN ('pass','fail','mismatch','expired','revoked')),
    failure_reason  TEXT,
    match_score     REAL,           -- Face euclidean distance (lower = better match)
    occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    device_id       TEXT
);
CREATE INDEX idx_ve_token      ON verification_events(token_id, occurred_at DESC);
CREATE INDEX idx_ve_touchpoint ON verification_events(touchpoint_id, occurred_at DESC);


-- =============================================================================
-- 7. ACCESSIBILITY
-- =============================================================================

CREATE TABLE accessibility_profiles (
    id                      UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    device_key              TEXT    NOT NULL UNIQUE,
    user_id                 UUID    REFERENCES users(id) ON DELETE SET NULL,
    -- Impairment flags
    visual_impairment       TEXT    CHECK (visual_impairment IN (
                                        NULL,'low_vision','blind','colour_blind'
                                    )),
    hearing_impairment      TEXT    CHECK (hearing_impairment IN (
                                        NULL,'hard_of_hearing','deaf'
                                    )),
    mobility_impairment     TEXT    CHECK (mobility_impairment IN (
                                        NULL,'wheelchair','walking_aid','reduced_mobility'
                                    )),
    nav_mode                TEXT    NOT NULL DEFAULT 'standard'
                            CHECK (nav_mode IN (
                                'standard','low_vision','blind',
                                'deaf','deaf_blind','wheelchair','cognitive_support'
                            )),
    haptics_enabled         BOOLEAN NOT NULL DEFAULT TRUE,
    haptic_intensity        REAL    NOT NULL DEFAULT 1.0
                            CHECK (haptic_intensity BETWEEN 0.0 AND 2.0),
    tts_enabled             BOOLEAN NOT NULL DEFAULT FALSE,
    tts_speed               REAL    NOT NULL DEFAULT 1.0,
    tts_voice               TEXT    NOT NULL DEFAULT 'default',
    high_contrast           BOOLEAN NOT NULL DEFAULT FALSE,
    font_scale              REAL    NOT NULL DEFAULT 1.0
                            CHECK (font_scale BETWEEN 0.5 AND 3.0),
    ar_enabled              BOOLEAN NOT NULL DEFAULT TRUE,
    avoid_stairs            BOOLEAN NOT NULL DEFAULT FALSE,
    avoid_escalators        BOOLEAN NOT NULL DEFAULT FALSE,
    extra_time_multiplier   REAL    NOT NULL DEFAULT 1.0,
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_access_user ON accessibility_profiles(user_id) WHERE user_id IS NOT NULL;

CREATE TABLE haptic_patterns (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT        NOT NULL UNIQUE,
    description     TEXT,
    category        TEXT        NOT NULL
                    CHECK (category IN ('navigation','alert','confirmation','warning')),
    duration_ms     SMALLINT    NOT NULL,
    -- navigator.vibrate() pattern array (alternating vibrate/pause ms)
    vibration_pattern   INT[]   NOT NULL,
    ahap_payload    JSONB,      -- iOS Core Haptics
    android_payload JSONB,      -- Android VibrationEffect
    intensity       REAL        NOT NULL DEFAULT 1.0
);

INSERT INTO haptic_patterns (name, description, category, duration_ms, vibration_pattern, intensity) VALUES
    ('turn_left',           'Short-long: turn left',            'navigation',    300, '{100,50,200}',     1.0),
    ('turn_right',          'Long-short: turn right',           'navigation',    300, '{200,50,100}',     1.0),
    ('continue_straight',   'Single brief: keep going',         'navigation',    100, '{100}',            0.7),
    ('destination_near',    'Triple escalating: almost there',  'navigation',    500, '{100,50,150,50,200}', 1.0),
    ('destination_reached', 'Sustained: arrived',               'navigation',    800, '{800}',            1.5),
    ('recalculating',       'Double tap: route changed',        'alert',         200, '{100,50,100}',     1.2),
    ('obstacle_ahead',      'Rapid staccato: obstacle',         'warning',       400, '{50,30,50,30,50,30,50}', 1.8),
    ('security_checkpoint', 'Three firm: security ahead',       'alert',         600, '{200,50,200,50,200}', 1.5),
    ('confirmation',        'Single click: confirmed',          'confirmation',   80, '{80}',             0.8),
    ('token_accepted',      'Smooth long: identity OK',         'confirmation',  500, '{500}',            1.2),
    ('token_rejected',      'Harsh double: identity fail',      'warning',       400, '{200,30,200}',     2.0);

CREATE TABLE audio_cues (
    id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT    NOT NULL UNIQUE,
    description     TEXT,
    category        TEXT    NOT NULL
                    CHECK (category IN ('navigation','alert','ambient','confirmation','warning')),
    audio_url       TEXT,
    tts_template    TEXT,
    duration_ms     SMALLINT,
    language_code   CHAR(5) NOT NULL DEFAULT 'en'
);

INSERT INTO audio_cues (name, description, category, tts_template, language_code) VALUES
    ('turn_left_near',      'Turn left',       'navigation', 'In {distance} metres, turn left',          'en'),
    ('turn_right_near',     'Turn right',      'navigation', 'In {distance} metres, turn right',         'en'),
    ('continue_straight',   'Continue ahead',  'navigation', 'Continue straight for {distance} metres',  'en'),
    ('destination_reached', 'Arrived',         'navigation', 'You have arrived at {poi_name}',            'en'),
    ('destination_near',    'Almost there',    'navigation', '{poi_name} is {distance} metres ahead',     'en'),
    ('security_ahead',      'Security',        'alert',      'Security checkpoint ahead. Prepare your documents.', 'en'),
    ('token_accepted',      'Identity OK',     'confirmation','Identity verified. Welcome.',              'en'),
    ('token_rejected',      'Identity fail',   'warning',    'Verification failed. Please see staff.',    'en'),
    ('rerouting',           'Reroute',         'alert',      'Route updated.',                            'en'),
    ('drift_warning',       'Drift high',      'alert',      'Position uncertain. Please confirm your location.', 'en');


-- =============================================================================
-- 8. FLIGHTS
-- =============================================================================

CREATE TABLE flights (
    id                  UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    airport_id          UUID    NOT NULL REFERENCES airports(id),
    flight_number       TEXT    NOT NULL,
    airline_iata        CHAR(2) NOT NULL,
    direction           TEXT    NOT NULL CHECK (direction IN ('departure','arrival')),
    scheduled_at        TIMESTAMPTZ NOT NULL,
    estimated_at        TIMESTAMPTZ,
    actual_at           TIMESTAMPTZ,
    gate_poi_id         UUID    REFERENCES pois(id),
    status              TEXT    NOT NULL DEFAULT 'scheduled'
                        CHECK (status IN (
                            'scheduled','boarding','gate_closed','departed',
                            'landed','cancelled','diverted','delayed'
                        )),
    baggage_belt        TEXT,
    raw_source          JSONB,
    synced_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (airport_id, flight_number, scheduled_at)
);
CREATE INDEX idx_flights_airport ON flights(airport_id, scheduled_at DESC);
CREATE INDEX idx_flights_gate    ON flights(gate_poi_id) WHERE gate_poi_id IS NOT NULL;

CREATE TABLE flight_subscriptions (
    id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    flight_id       UUID    NOT NULL REFERENCES flights(id) ON DELETE CASCADE,
    subscribed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    notify_boarding     BOOLEAN NOT NULL DEFAULT TRUE,
    notify_gate_change  BOOLEAN NOT NULL DEFAULT TRUE,
    notify_delay        BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (user_id, flight_id)
);
CREATE INDEX idx_flightsub_user ON flight_subscriptions(user_id);


-- =============================================================================
-- 9. NOTIFICATION QUEUE
-- =============================================================================

CREATE TABLE notification_queue (
    id                  UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID    REFERENCES users(id) ON DELETE CASCADE,
    device_key          TEXT,
    channel             TEXT    NOT NULL
                        CHECK (channel IN ('push','tts','haptic','ar_overlay','sms')),
    haptic_pattern_id   UUID    REFERENCES haptic_patterns(id),
    audio_cue_id        UUID    REFERENCES audio_cues(id),
    title               TEXT,
    body                TEXT,
    payload             JSONB   NOT NULL DEFAULT '{}',
    priority            TEXT    NOT NULL DEFAULT 'normal'
                        CHECK (priority IN ('low','normal','high','critical')),
    status              TEXT    NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','sent','failed','suppressed')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    sent_at             TIMESTAMPTZ,
    failure_reason      TEXT,
    dedup_key           TEXT
);
CREATE UNIQUE INDEX idx_notif_dedup ON notification_queue (device_key, dedup_key) NULLS NOT DISTINCT;
CREATE INDEX idx_notif_pending ON notification_queue(status, created_at) WHERE status = 'pending';
CREATE INDEX idx_notif_device  ON notification_queue(device_key) WHERE device_key IS NOT NULL;

CREATE TABLE push_subscriptions (
    id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_key      TEXT    NOT NULL,
    endpoint        TEXT    NOT NULL,
    p256dh_key      TEXT    NOT NULL,   -- browser public key
    auth_key        TEXT    NOT NULL,   -- browser auth secret
    user_agent      TEXT,
    subscribed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, endpoint)
);
CREATE INDEX idx_push_sub_user ON push_subscriptions(user_id);

-- =============================================================================
-- 10. SEED DATA
-- =============================================================================

INSERT INTO airports (id, iata_code, icao_code, name, city, country_code, timezone,
                      floor_plan_url, px_per_metre, width_m, height_m) VALUES
    ('a0000000-0000-0000-0000-000000000001',
     'DXB', 'OMDB', 'Dubai International Airport', 'Dubai', 'AE', 'Asia/Dubai',
     '/assets/floorplan.svg', 10, 400, 200);

INSERT INTO zones (id, airport_id, name, zone_type, x_min_m, y_min_m, x_max_m, y_max_m) VALUES
    ('20000000-0000-0000-0000-000000000001',
     'a0000000-0000-0000-0000-000000000001',
     'Public Zone', 'public', 0, 0, 110, 200),
    ('20000000-0000-0000-0000-000000000002',
     'a0000000-0000-0000-0000-000000000001',
     'Post-Security Corridor', 'post_security', 110, 0, 400, 200),
    ('20000000-0000-0000-0000-000000000003',
     'a0000000-0000-0000-0000-000000000001',
     'Gate B Concourse', 'gate_area', 200, 60, 380, 150);

INSERT INTO pois (id, airport_id, zone_id, category_id, name, x_m, y_m, entrance_x_m, entrance_y_m,
                  gate_number, is_accessible, tts_label, haptic_cue) VALUES
    ('b0000000-0000-0000-0000-000000000001',
     'a0000000-0000-0000-0000-000000000001',
     '20000000-0000-0000-0000-000000000001',
     (SELECT id FROM poi_categories WHERE slug='checkin'),
     'Check-in Zone A', 50, 30, 50, 35, NULL, TRUE,
     'Check-in Zone Alpha, straight ahead', 'continue_straight'),

    ('b0000000-0000-0000-0000-000000000002',
     'a0000000-0000-0000-0000-000000000001',
     '20000000-0000-0000-0000-000000000001',
     (SELECT id FROM poi_categories WHERE slug='security'),
     'Security Checkpoint', 110, 30, 110, 35, NULL, TRUE,
     'Security checkpoint ahead, please prepare documents', 'security_checkpoint'),

    ('b0000000-0000-0000-0000-000000000003',
     'a0000000-0000-0000-0000-000000000001',
     '20000000-0000-0000-0000-000000000003',
     (SELECT id FROM poi_categories WHERE slug='gate'),
     'Gate B7', 280, 100, 278, 100, 'B7', TRUE,
     'Gate Bravo Seven, your destination, 30 metres ahead', 'destination_near'),

    ('b0000000-0000-0000-0000-000000000004',
     'a0000000-0000-0000-0000-000000000001',
     '20000000-0000-0000-0000-000000000003',
     (SELECT id FROM poi_categories WHERE slug='gate'),
     'Gate B12', 340, 100, 338, 100, 'B12', TRUE,
     'Gate Bravo Twelve', NULL),

    ('b0000000-0000-0000-0000-000000000005',
     'a0000000-0000-0000-0000-000000000001',
     '20000000-0000-0000-0000-000000000002',
     (SELECT id FROM poi_categories WHERE slug='restroom'),
     'Restroom', 180, 20, 180, 25, NULL, TRUE,
     'Restroom, ten metres to your right', 'turn_right'),

    ('b0000000-0000-0000-0000-000000000006',
     'a0000000-0000-0000-0000-000000000001',
     '20000000-0000-0000-0000-000000000002',
     (SELECT id FROM poi_categories WHERE slug='food'),
     'Food Court', 160, 120, 160, 115, NULL, TRUE,
     'Food court, straight ahead', 'continue_straight'),

    ('b0000000-0000-0000-0000-000000000007',
     'a0000000-0000-0000-0000-000000000001',
     '20000000-0000-0000-0000-000000000002',
     (SELECT id FROM poi_categories WHERE slug='charging'),
     'Charging Station', 200, 90, 200, 87, NULL, TRUE,
     'Charging station, five metres on your left', 'turn_left');

INSERT INTO nav_nodes (id, airport_id, poi_id, x_m, y_m, node_type, is_accessible) VALUES
    ('c0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001', NULL,                                        20,  30,  'waypoint',     TRUE),
    ('c0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001',       50,  35,  'poi_entrance', TRUE),
    ('c0000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000001', NULL,                                        85,  30,  'waypoint',     TRUE),
    ('c0000000-0000-0000-0000-000000000004','a0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000002',       110, 35,  'security',     TRUE),
    ('c0000000-0000-0000-0000-000000000005','a0000000-0000-0000-0000-000000000001', NULL,                                        145, 60,  'waypoint',     TRUE),
    ('c0000000-0000-0000-0000-000000000006','a0000000-0000-0000-0000-000000000001', NULL,                                        195, 100, 'waypoint',     TRUE),
    ('c0000000-0000-0000-0000-000000000007','a0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000003',       278, 100, 'poi_entrance', TRUE),
    ('c0000000-0000-0000-0000-000000000008','a0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000004',       338, 100, 'poi_entrance', TRUE);

INSERT INTO nav_edges (from_node_id, to_node_id, distance_m, edge_type, is_accessible, is_bidirectional) VALUES
    ('c0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000002', 31,  'walkway', TRUE, TRUE),
    ('c0000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000003', 36,  'walkway', TRUE, TRUE),
    ('c0000000-0000-0000-0000-000000000003','c0000000-0000-0000-0000-000000000004', 26,  'walkway', TRUE, TRUE),
    ('c0000000-0000-0000-0000-000000000004','c0000000-0000-0000-0000-000000000005', 44,  'walkway', TRUE, TRUE),
    ('c0000000-0000-0000-0000-000000000005','c0000000-0000-0000-0000-000000000006', 56,  'walkway', TRUE, TRUE),
    ('c0000000-0000-0000-0000-000000000006','c0000000-0000-0000-0000-000000000007', 83,  'walkway', TRUE, TRUE),
    ('c0000000-0000-0000-0000-000000000006','c0000000-0000-0000-0000-000000000008', 143, 'walkway', TRUE, TRUE);

INSERT INTO replay_tracks (id, airport_id, name, description, track_data, total_steps, duration_ms, poi_sequence) VALUES
    ('e0000000-0000-0000-0000-000000000001',
     'a0000000-0000-0000-0000-000000000001',
     'Entrance to Gate B7',
     'Full demo: entrance → check-in → security → Gate B7',
     '[
       {"x_m":20,  "y_m":30,  "heading_deg":90, "drift_radius_m":0.0, "elapsed_ms":0},
       {"x_m":33,  "y_m":30,  "heading_deg":90, "drift_radius_m":0.3, "elapsed_ms":1500},
       {"x_m":50,  "y_m":30,  "heading_deg":90, "drift_radius_m":0.6, "elapsed_ms":3000},
       {"x_m":68,  "y_m":30,  "heading_deg":90, "drift_radius_m":0.9, "elapsed_ms":4500},
       {"x_m":85,  "y_m":30,  "heading_deg":90, "drift_radius_m":1.1, "elapsed_ms":6000},
       {"x_m":110, "y_m":30,  "heading_deg":90, "drift_radius_m":0.2, "elapsed_ms":8000},
       {"x_m":124, "y_m":42,  "heading_deg":42, "drift_radius_m":0.4, "elapsed_ms":9500},
       {"x_m":136, "y_m":54,  "heading_deg":18, "drift_radius_m":0.6, "elapsed_ms":11000},
       {"x_m":145, "y_m":70,  "heading_deg":0,  "drift_radius_m":0.8, "elapsed_ms":12500},
       {"x_m":150, "y_m":88,  "heading_deg":8,  "drift_radius_m":1.0, "elapsed_ms":14000},
       {"x_m":168, "y_m":100, "heading_deg":90, "drift_radius_m":1.1, "elapsed_ms":15500},
       {"x_m":195, "y_m":100, "heading_deg":90, "drift_radius_m":1.3, "elapsed_ms":17500},
       {"x_m":225, "y_m":100, "heading_deg":90, "drift_radius_m":1.6, "elapsed_ms":19500},
       {"x_m":255, "y_m":100, "heading_deg":90, "drift_radius_m":1.9, "elapsed_ms":21500},
       {"x_m":278, "y_m":100, "heading_deg":90, "drift_radius_m":0.2, "elapsed_ms":24000}
     ]'::jsonb,
     88, 24000,
     ARRAY[
       'b0000000-0000-0000-0000-000000000001'::uuid,
       'b0000000-0000-0000-0000-000000000002'::uuid,
       'b0000000-0000-0000-0000-000000000003'::uuid
     ]);

-- Demo user (password = "hackathon2024" bcrypt hash)
INSERT INTO users (id, username, password_hash, auth_provider, display_name,
                   preferred_language, nationality_code, is_active, is_verified, gdpr_consent_at) VALUES
    ('d0000000-0000-0000-0000-000000000001',
     'demo', '$2b$12$nGlZIndZKRxLCH6Is335M.K5hClHrQ.1Er.eGkrLFIsIhTh99qMNO',
     'local', 'Alex Demo', 'en', 'GB', TRUE, TRUE, now());

-- Demo travel document
INSERT INTO travel_documents (id, user_id, document_type,
    document_number_enc, surname_enc, given_names_enc, dob_enc,
    nationality_code, issuing_country, expiry_date, verified_by, verified_at) VALUES
    ('dd000000-0000-0000-0000-000000000001',
     'd0000000-0000-0000-0000-000000000001',
     'passport',
     'enc::P123456789', 'enc::DEMO', 'enc::ALEX', 'enc::19900101',
     'GB', 'GB', '2030-01-01', 'nfc_chip', now());

-- Demo flight
INSERT INTO flights (id, airport_id, flight_number, airline_iata, direction,
                     scheduled_at, gate_poi_id, status) VALUES
    ('f1000000-0000-0000-0000-000000000001',
     'a0000000-0000-0000-0000-000000000001',
     'EK204', 'EK', 'departure',
     now() + INTERVAL '3 hours',
     'b0000000-0000-0000-0000-000000000003',
     'boarding');

-- Demo touchpoints
INSERT INTO touchpoints (id, airport_id, poi_id, name, touchpoint_type,
                          required_claims, required_assurance) VALUES
    ('ae000000-0000-0000-0000-000000000001',
     'a0000000-0000-0000-0000-000000000001',
     'b0000000-0000-0000-0000-000000000002',
     'Security Lane 3', 'security_lane',
     ARRAY['ticket_valid'], 'ial2'),
    ('ae000000-0000-0000-0000-000000000002',
     'a0000000-0000-0000-0000-000000000001',
     'b0000000-0000-0000-0000-000000000003',
     'Gate B7 Boarding', 'boarding_gate',
     ARRAY['ticket_valid','nationality_verified'], 'ial2');

-- Demo accessibility profile
INSERT INTO accessibility_profiles (device_key, user_id, nav_mode,
    haptics_enabled, haptic_intensity, tts_enabled, ar_enabled) VALUES
    ('demo-device-key-001',
     'd0000000-0000-0000-0000-000000000001',
     'standard', TRUE, 1.0, FALSE, TRUE);


-- =============================================================================
-- VIEWS
-- =============================================================================

CREATE VIEW v_live_positions AS
SELECT DISTINCT ON (pe.session_id)
    pe.session_id,
    pe.x_m,
    pe.y_m,
    pe.heading_deg,
    pe.drift_radius_m,
    pe.map_matched,
    pe.source,
    pe.estimated_at,
    s.nav_mode,
    s.ar_enabled,
    s.airport_id,
    s.destination_poi_id,
    u.display_name
FROM position_estimates pe
JOIN dr_sessions s ON s.id = pe.session_id
LEFT JOIN users  u ON u.id = s.user_id
WHERE s.status = 'active'
ORDER BY pe.session_id, pe.estimated_at DESC;

CREATE VIEW v_accessible_edges AS
SELECT * FROM nav_edges
WHERE is_accessible = TRUE AND edge_type NOT IN ('stairs');

CREATE VIEW v_poi_nodes AS
SELECT
    p.id            AS poi_id,
    p.name,
    c.slug          AS category,
    p.gate_number,
    p.airport_id,
    p.x_m, p.y_m,
    p.tts_label,
    p.haptic_cue,
    p.is_accessible,
    n.id            AS node_id
FROM pois p
JOIN poi_categories c ON c.id = p.category_id
LEFT JOIN nav_nodes n ON n.poi_id = p.id
WHERE p.is_active;

CREATE VIEW v_user_identity_status AS
SELECT
    u.id,
    u.username,
    u.display_name,
    u.is_verified,
    bp.id               AS biometric_id,
    bp.modality,
    bp.quality_score,
    bp.face_descriptor  IS NOT NULL AS has_face_descriptor,
    td.document_type,
    td.nationality_code,
    td.expiry_date,
    td.verified_by,
    vt.id               AS active_token_id,
    vt.claims,
    vt.assurance_level,
    vt.expires_at       AS token_expires_at,
    vt.is_revoked       AS token_revoked
FROM users u
LEFT JOIN biometric_profiles bp ON bp.user_id = u.id AND bp.is_primary AND NOT bp.is_revoked
LEFT JOIN travel_documents   td ON td.user_id = u.id AND td.is_active
LEFT JOIN verification_tokens vt ON vt.user_id = u.id
                                 AND NOT vt.is_revoked
                                 AND vt.expires_at > now()
WHERE u.is_active;


-- =============================================================================
-- FUNCTIONS
-- =============================================================================

-- Dead-reckoning step (3% drift model)
CREATE OR REPLACE FUNCTION dr_step(
    p_x REAL, p_y REAL, p_heading_deg REAL, p_stride_m REAL, p_current_drift REAL
)
RETURNS TABLE (new_x REAL, new_y REAL, new_drift REAL)
LANGUAGE sql IMMUTABLE AS $$
    SELECT
        (p_x + p_stride_m * SIN(RADIANS(p_heading_deg)))::REAL,
        (p_y + p_stride_m * COS(RADIANS(p_heading_deg)))::REAL,
        (p_current_drift + p_stride_m * 0.03)::REAL;
$$;

-- Atomic token validation + event logging
CREATE OR REPLACE FUNCTION consume_token(
    p_token_hash    BYTEA,
    p_touchpoint_id UUID,
    p_match_score   REAL DEFAULT NULL,
    p_device_id     TEXT DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_token     verification_tokens%ROWTYPE;
    v_touch     touchpoints%ROWTYPE;
    v_outcome   TEXT;
    v_reason    TEXT;
BEGIN
    SELECT * INTO v_token
    FROM   verification_tokens
    WHERE  token_hash = p_token_hash AND NOT is_revoked
    FOR UPDATE SKIP LOCKED;

    IF NOT FOUND THEN
        v_outcome := 'fail'; v_reason := 'token_not_found';
    ELSIF v_token.expires_at < now() THEN
        v_outcome := 'expired'; v_reason := 'token_expired';
    ELSE
        SELECT * INTO v_touch FROM touchpoints WHERE id = p_touchpoint_id;
        IF EXISTS (
            SELECT 1 FROM unnest(v_touch.required_claims) rc
            WHERE NOT (v_token.claims ? rc AND (v_token.claims->>rc)::BOOLEAN)
        ) THEN
            v_outcome := 'fail'; v_reason := 'insufficient_claims';
        ELSE
            v_outcome := 'pass';
        END IF;
    END IF;

    INSERT INTO verification_events
        (token_id, touchpoint_id, outcome, failure_reason, match_score, device_id)
    VALUES
        (v_token.id, p_touchpoint_id, v_outcome, v_reason, p_match_score, p_device_id);

    RETURN jsonb_build_object(
        'outcome', v_outcome,
        'reason',  v_reason,
        'claims',  CASE WHEN v_outcome = 'pass' THEN v_token.claims ELSE NULL END
    );
END;
$$;

-- Enqueue notification with dedup
CREATE OR REPLACE FUNCTION enqueue_notification(
    p_user_id       UUID,    p_device_key    TEXT,
    p_channel       TEXT,    p_title         TEXT,
    p_body          TEXT,    p_payload       JSONB DEFAULT '{}',
    p_priority      TEXT DEFAULT 'normal',
    p_haptic_name   TEXT DEFAULT NULL,
    p_dedup_key     TEXT DEFAULT NULL
)
RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE
    v_haptic_id UUID;
    v_id        UUID;
BEGIN
    IF p_haptic_name IS NOT NULL THEN
        SELECT id INTO v_haptic_id FROM haptic_patterns WHERE name = p_haptic_name;
    END IF;
    INSERT INTO notification_queue
        (user_id, device_key, channel, haptic_pattern_id, title, body, payload, priority, dedup_key)
    VALUES
        (p_user_id, p_device_key, p_channel, v_haptic_id, p_title, p_body, p_payload, p_priority, p_dedup_key)
    ON CONFLICT (device_key, dedup_key) DO NOTHING
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$;
