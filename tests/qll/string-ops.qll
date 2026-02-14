// @expect: 0
// @libs: std
// @cycles: 10000
function main(): byte {
  // equal
  if (!std::str::equal("abc", "abc")) { return 1; }
  if (std::str::equal("abc", "abd")) { return 2; }
  if (std::str::equal("ab", "abc")) { return 3; }

  // index_of
  if (std::str::index_of("hello", 108) != 2) { return 4; }  // 'l' = 108
  if (std::str::index_of("hello", 122) != -1) { return 5; } // 'z' = 122

  // starts_with
  if (!std::str::starts_with("hello", "hel")) { return 6; }
  if (std::str::starts_with("hello", "world")) { return 7; }

  // ends_with
  if (!std::str::ends_with("hello", "llo")) { return 8; }
  if (std::str::ends_with("hello", "hel")) { return 9; }

  // to_upper / to_lower
  var buf: byte[3] = "abc";
  std::str::to_upper(buf);
  if (buf[0] != 65) { return 10; } // 'A'
  std::str::to_lower(buf);
  if (buf[0] != 97) { return 11; } // 'a'

  // concat
  var c: string = std::str::concat("Hi", "Lo");
  if (len c != 4) { return 12; }
  if (c[0] != 72) { return 13; }  // 'H'
  if (c[2] != 76) { return 14; }  // 'L'

  return 0;
}
