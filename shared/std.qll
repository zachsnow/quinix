// Quinix Standard Library - shared components
// Requires std::console::print to be provided by context (lib, bare, kernel)
namespace std {
  // Slice type - structurally equivalent to the built-in T[] type.
  type slice<T> = struct {
    pointer: * T;
    length: byte;
    capacity: byte;
  };

  namespace math {
    function max(i: byte, j: byte): byte {
      return i > j ? i : j;
    }
    function min(i: byte, j: byte): byte {
      return i < j ? i : j;
    }
  }

  // Intrusive lists.
  namespace ilist {
    function add<T>(ilist: *T, el: T): bool {
      if (!ilist) {
        return false;
      }

      var head = *ilist;
      if (!head) {
        *ilist = el;
        return true;
      }

      while (head->next) {
        head = head->next;
      }
      head->next = el;
      return true;
    }

    function remove<T>(ilist: *T, el: T): void {
      if (!ilist || !*ilist) {
        return;
      }

      // If removing the head
      if (*ilist == el) {
        *ilist = (*ilist)->next;
        return;
      }

      // Otherwise traverse to find the element
      var prev = *ilist;
      while (prev->next) {
        if (prev->next == el) {
          prev->next = el->next;
          return;
        }
        prev = prev->next;
      }
    }

    function next<T>(ilist: T, el: T): T {
      var p = ilist;
      while (p) {
        if (p == el) {
          return p->next || ilist;
        }
        p = p->next;
      }
      return null;
    }

    function foreach<T>(ilist: T, fn: (T) => void): void {
      while (ilist) {
        fn(ilist);
        ilist = ilist->next;
      }
    }

    function length<T>(ilist: T): byte {
      var i = 0;
      for (var p = ilist; !!p; p = p->next) {
        i = i + 1;
      }
      return i;
    }
  }

  // Auto-resizing vectors.
  type vector<T> = T[];
  namespace vector {
    function _increase_capacity<T>(vec: * vector<T>): void {
      var v: T[] = new T[2 * cap *vec];
      len v = len *vec;
      for (var i = 0; i < len v; i = i + 1) {
        v[i] = (*vec)[i];
      }
      delete *vec;
      *vec = v;
    }

    function create<T>(n: byte): vector<T> {
      var v: T[] = new T[n];
      len v = 0;
      return v;
    }

    function destroy<T>(vec: vector<T>): void {
      delete vec;
    }

    function from_array<T>(arr: T[]): vector<T> {
      return new T[] = arr;
    }

    function add<T>(vec: * vector<T>, element: T): void {
      if (len *vec == cap *vec) {
        _increase_capacity(vec);
      }
      var i = len *vec;
      len *vec = i + 1;
      (*vec)[i] = element;
    }

    function remove<T>(vec: vector<T>, index: byte): void {
      var n = len vec - 1;
      for (var i = index; i < n; i = i + 1) {
        vec[i] = vec[i + 1];
      }
      len vec = n;
    }

    function remove_by<T, C>(vec: vector<T>, fn: (T, C) => bool, context: C): void {
      var index = find_by(vec, fn, context);
      if (index == -1) {
        return;
      }
      remove(vec, index);
    }

    function find<T>(vec: vector<T>, el: T): byte {
      for (var i = 0; i < len vec; i = i + 1) {
        if (el == vec[i]) {
          return i;
        }
      }
      return -1;
    }

    function find_by<T, C>(vec: vector<T>, fn: (T, C) => bool, context: C): byte {
      for (var i = 0; i < len vec; i = i + 1) {
        var el = vec[i];
        if (fn(el, context)) {
          return i;
        }
      }
      return -1;
    }

    function foreach<T>(vec: vector<T>, fn: (T) => void): void {
      for (var i = 0; i < len vec; i = i + 1) {
        fn(vec[i]);
      }
    }
  }

  namespace str {
    function from_string(s: string): string {
      var new_s: byte[] = new byte[len s];
      std::copy(new_s, s);
      return <string>new_s;
    }

    function reverse(buffer: string): void {
      var length = len buffer;
      for (var i = 0; i < length / 2; i = i + 1) {
        var c = buffer[i];
        buffer[i] = buffer[length - 1 - i];
        buffer[length - 1 - i] = c;
      }
    }

    function ntoa(number: byte, buffer: string, base: byte, allowNegative: bool): bool {
      len buffer = cap buffer;

      if (cap buffer < 1) {
        return false;
      }

      var negative = false;
      if (allowNegative && number < 0) {
        negative = true;
        number = -number;
      }

      var i = 0;
      while (number != 0) {
        var remainder = number % base;
        buffer[i] = remainder > 9 ?
          remainder - 10 + 97 :
          remainder + 48;
        i = i + 1;

        if (i >= len buffer) {
          return false;
        }

        number = number / base;
      }

      // Handle 0.
      if (i == 0) {
        buffer[i] = 48;
        i = i + 1;
      }

      // Sign.
      if (negative) {
        if (i >= len buffer) {
          return false;
        }
        buffer[i] = 45;
        i = i + 1;
      }

      len buffer = i;
      reverse(buffer);
      return true;
    }

    function itoa(number: byte, buffer: string, base: byte): bool {
      return ntoa(number, buffer, base, true);
    }

    function utoa(number: byte, buffer: string, base: byte): bool {
      return ntoa(number, buffer, base, false);
    }
  }

  type fmt = struct {
    fmt_type: fmt::fmt_type;
    n: byte;
    base: byte;
    s: string;
    p: * byte;
  };

  namespace fmt {
    type fmt_type = byte;
    namespace fmt_type {
      .constant global S: fmt_type = 1;
      .constant global U: fmt_type = 2;
      .constant global I: fmt_type = 3;
      .constant global P: fmt_type = 4;
    }

    .constant global nl: fmt = fs("\n");

    function fs(s: string): fmt {
      return fmt {
        fmt_type = fmt_type::S,
        s = s,
      };
    }
    function fi(n: byte): fmt {
      return fmt {
        fmt_type = fmt_type::I,
        n = n,
      };
    }
    function fu(n: byte): fmt {
      return fmt {
        fmt_type = fmt_type::U,
        n = n,
      };
    }
    function fp(p: * byte): fmt {
      return fmt {
        fmt_type = fmt_type::P,
        p = p,
      };
    }

    function print(formats: fmt[]): bool {
      var buffer: byte[33];

      for (var i = 0; i < len formats; i = i + 1) {
        var f = formats[i];
        if (f.fmt_type == fmt_type::U) {
          if (!str::utoa(f.n, buffer, f.base || 10)) {
            return false;
          }
          console::print(buffer);
        }
        else if (f.fmt_type == fmt_type::I) {
          if (!str::itoa(f.n, buffer, f.base || 10)) {
            return false;
          }
          console::print(buffer);
        }
        else if (f.fmt_type == fmt_type::P) {
          if (!str::utoa(<unsafe byte>f.p, buffer, f.base || 16)) {
            return false;
          }
          console::print(buffer);
        }
        else if (f.fmt_type == fmt_type::S) {
          console::print(f.s);
        }
        else {
          return false;
        }
      }
      return true;
    }
  }

  function copy<T>(destination: T[], source: T[]): void {
    var length = math::min(cap destination, len source);
    for (var i = 0; i < length; i = i + 1) {
      destination[i] = source[i];
    }
    len destination = length;
  }

  function unsafe_copy<T>(destination: * T, source: * T, length: byte): void {
    for (var i = 0; i < length; i = i + 1) {
      destination[i] = source[i];
    }
  }
}
