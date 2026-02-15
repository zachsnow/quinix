// @expect: 2
type num = byte;
type Point = struct {
  x: num;
  y: num;
};
function main(): byte {
  return sizeof Point;
}
