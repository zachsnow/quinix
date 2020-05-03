type Point = struct {
    x: byte;
    y: byte;
};
global g: Point = Point {
    x = 10,
    y = 20,
};
function main(): byte {
    return g.y;
}
