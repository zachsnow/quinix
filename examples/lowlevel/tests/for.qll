// @expect: 45
function main(): byte {
  var j = 0;
  for(var i = 0; i < 10; i = i + 1){
    j = j + i;
  }
  return j;
}
