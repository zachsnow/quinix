// @expect: 30

type int = byte;

function main(): int {
    var i: int = 10;
    var j: int = 0;

    while(i > <int>0){
        i = i - 1;
        j = j + 3;
    }

    return j;
}
