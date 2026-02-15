// @expect: 30

type num = byte;

function main(): num {
    var i: num = 10;
    var j: num = 0;

    while(i > <num>0){
        i = i - 1;
        j = j + 3;
    }

    return j;
}
