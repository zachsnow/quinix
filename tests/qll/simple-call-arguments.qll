// @expect: 40
function main(): byte {
    return fn(10,20,30,40);
}

function fn(a: byte, b: byte, c: byte, d: byte): byte {
    return d;
}
