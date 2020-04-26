type Point = struct {
    x: byte;
    y: byte;
};

function main(): byte {
    var p: Point;
    p.x = 2;
    p.y = 3;

    var q: Point = p;
    q.y = 4;

    return q.x + q.y;
}
