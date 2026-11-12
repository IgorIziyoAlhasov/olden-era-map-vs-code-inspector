export function decodePlacementOrientation(raw) {
  if (Number.isInteger(raw) && raw >= 0 && raw <= 3) {
    return { rotation: raw, mirrored: false };
  }
  if (Number.isInteger(raw) && raw >= 10 && raw <= 13) {
    return { rotation: raw - 10, mirrored: true };
  }
  return null;
}
