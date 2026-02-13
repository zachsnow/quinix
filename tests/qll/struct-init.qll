// @expect: 42
// @cycles: 5000
type Pair = struct {
  data: byte[4];
  tag: byte;
};

function main(): byte {
  var p = Pair { tag = 42 };
  return p.tag;
}
