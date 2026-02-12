// @skip: uses 2->hi syntax which is currently a type error
function main(): byte {
  var i = 0;

  if(1 && 2){
    i = 10;
  }
  if(4 && 2->hi >= 4){
    i = 11;
  }

  return i;
}
