type Point = struct {
    x: byte;
    y: byte;
};

function main(): byte {
    var p: Point;
    p.x = 2;
    p.y = 3;
    var pp = &p;
    pp->x = 4;
    pp->y = 5;
    return p.y;
}
