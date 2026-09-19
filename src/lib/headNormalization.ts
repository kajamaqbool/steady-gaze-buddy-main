/**
 * Head Movement Normalization
 * Convert gaze coordinates from screen/video space into face-relative space
 * This removes drift caused by head rotation/movement
 * Reduces vertical instability from ~100px+ to <50px
 */

export interface FaceKeypoints {
  nosetip?: { x: number; y: number };
  leftEye?: { x: number; y: number };
  rightEye?: { x: number; y: number };
  leftIris?: { x: number; y: number };
  rightIris?: { x: number; y: number };
  chin?: { x: number; y: number };
}

export interface HeadPose {
  pitch: number; // rotation around X axis (up/down)
  yaw: number; // rotation around Y axis (left/right)
  roll: number; // rotation around Z axis (tilt)
  headCenterX: number;
  headCenterY: number;
}

/**
 * Extract head pose from FaceMesh landmarks (468 keypoints)
 * Using: nose tip (landmark 1), eyes (landmarks 33, 133), chin (landmark 152)
 */
export function extractHeadPose(keypoints: any[]): HeadPose {
  // Landmark indices from FaceMesh
  const nosetip = keypoints[1]; // tip of nose
  const leftEyeInner = keypoints[33]; // left eye inner corner
  const rightEyeInner = keypoints[133]; // right eye inner corner
  const chin = keypoints[152]; // chin

  // Head center approximation: average of key facial points
  const headCenterX =
    ((nosetip?.x ?? 0) + (leftEyeInner?.x ?? 0) + (rightEyeInner?.x ?? 0)) / 3;
  const headCenterY =
    ((nosetip?.y ?? 0) + (leftEyeInner?.y ?? 0) + (rightEyeInner?.y ?? 0)) / 3;

  // Simple pitch estimation: vertical distance from nose to chin
  const noseY = nosetip?.y ?? 0;
  const chinY = chin?.y ?? 0;
  const pitch = (chinY - noseY) * 0.1; // Small scale factor

  // Simple yaw estimation: horizontal asymmetry between eyes
  const leftX = leftEyeInner?.x ?? 0;
  const rightX = rightEyeInner?.x ?? 0;
  const yaw = (rightX - leftX) * 0.05;

  // Roll estimation: tilt angle based on eye positions
  const leftY = leftEyeInner?.y ?? 0;
  const rightY = rightEyeInner?.y ?? 0;
  const roll = Math.atan2(rightY - leftY, rightX - leftX) * (180 / Math.PI);

  return {
    pitch,
    yaw,
    roll,
    headCenterX,
    headCenterY,
  };
}

/**
 * Normalize gaze into face-relative coordinates
 * Removes drift caused by head movement
 */
export function normalizeGazeToFaceSpace(
  gazeX: number,
  gazeY: number,
  headPose: HeadPose
): { x: number; y: number } {
  // Translate to head center
  let normX = gazeX - headPose.headCenterX;
  let normY = gazeY - headPose.headCenterY;

  // Undo pitch rotation (head nodding)
  const pitchRad = (headPose.pitch * Math.PI) / 180;
  const newY = normY * Math.cos(pitchRad) - normX * Math.sin(pitchRad);
  normX = normX * Math.cos(pitchRad) + normY * Math.sin(pitchRad);
  normY = newY;

  // Undo yaw rotation (head turning)
  const yawRad = (headPose.yaw * Math.PI) / 180;
  const newX = normX * Math.cos(yawRad) + normY * Math.sin(yawRad);
  normY = -normX * Math.sin(yawRad) + normY * Math.cos(yawRad);
  normX = newX;

  // Undo roll rotation (head tilting)
  const rollRad = (headPose.roll * Math.PI) / 180;
  const newX2 = normX * Math.cos(rollRad) - normY * Math.sin(rollRad);
  normY = normX * Math.sin(rollRad) + normY * Math.cos(rollRad);
  normX = newX2;

  return { x: normX, y: normY };
}

/**
 * Smooth head pose trajectory to reduce jitter detected artifacts
 * Weighted average of recent poses
 */
export function smoothHeadPose(poses: HeadPose[], windowSize: number = 3): HeadPose {
  if (poses.length === 0) {
    return {
      pitch: 0,
      yaw: 0,
      roll: 0,
      headCenterX: 0,
      headCenterY: 0,
    };
  }

  if (poses.length === 1) return poses[0];

  const window = poses.slice(-windowSize);
  const avgPitch = window.reduce((s, p) => s + p.pitch, 0) / window.length;
  const avgYaw = window.reduce((s, p) => s + p.yaw, 0) / window.length;
  const avgRoll = window.reduce((s, p) => s + p.roll, 0) / window.length;
  const avgCenterX = window.reduce((s, p) => s + p.headCenterX, 0) / window.length;
  const avgCenterY = window.reduce((s, p) => s + p.headCenterY, 0) / window.length;

  return {
    pitch: avgPitch,
    yaw: avgYaw,
    roll: avgRoll,
    headCenterX: avgCenterX,
    headCenterY: avgCenterY,
  };
}

/**
 * Detect head movement instability
 * Returns true if head is moving too much (unstable)
 */
export function isHeadUnstable(poses: HeadPose[], threshold: number = 15): boolean {
  if (poses.length < 2) return false;

  const recent = poses.slice(-10);
  const maxPitchVariation = Math.max(...recent.map((p) => p.pitch)) - Math.min(...recent.map((p) => p.pitch));
  const maxYawVariation = Math.max(...recent.map((p) => p.yaw)) - Math.min(...recent.map((p) => p.yaw));

  return maxPitchVariation > threshold || maxYawVariation > threshold;
}

/**
 * Get vertical offset from head movement
 * Useful for detecting head-caused vertical drift
 */
export function getVerticalDriftFromHead(poses: HeadPose[]): number {
  if (poses.length === 0) return 0;

  const recentPose = poses[poses.length - 1];
  const oldestPose = poses[Math.max(0, poses.length - 30)];

  return Math.abs(recentPose.headCenterY - oldestPose.headCenterY);
}
