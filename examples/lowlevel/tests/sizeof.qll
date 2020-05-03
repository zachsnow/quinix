type int = byte;
type Point = struct {
  x: int;
  y: int;
};
function main(): byte {
  return sizeof Point;
}
