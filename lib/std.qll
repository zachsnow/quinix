///////////////////////////////////////////////////////////////////////
// Quinix Standard Library
///////////////////////////////////////////////////////////////////////
namespace std {
  namespace math {
    function max(i: byte, j: byte): byte {
      return i > j ? i : j;
    }
    function min(i: byte, j: byte): byte {
      return i < j ? i : j;
    }
  }

  //
  // Intrusive lists.
  //
  namespace ilist {
    function add<T>(ilist: *T, el: T): bool {
      if(!ilist){
        return false;
      }

      var head = *ilist;
      if(!head){
        *ilist = el;
        return true;
      }

      while(head->next){
        head = head->next;
      }
      head->next = el;
      return true;
    }

    function remove<T>(ilist: T, el: T): void {
      if(!ilist){
        return false;
      }
    }

    function next<T>(ilist: T, el: T): T {
      var p = ilist;
      while(p){
        if(p == el){
          return p->next || ilist;
        }
        p = p->next;
      }
      return  null;
    }

    function foreach<T>(ilist: T, fn: (T) => void): void {
      while(ilist){
        fn(ilist);
        ilist = ilist->next;
      }
    }

    function length<T>(ilist: T): byte {
      var i = 0;
      for(var p = ilist; !!p; p = p->next){
        i = i + 1;
      }
      return i;
    }
  }

  //
  // Auto-resizing vectors.
  //
  type vector<T> = T[];
  namespace vector {
    function _increase_capacity<T>(vec: * vector<T>): void {
      var v = new T[2 * capacity *vec];
      len v = len *vec;
      for(var i = 0; i < len v; i = i + 1){
        v[i] = (*vec)[i];
      }
      delete *vec;
      *vec = v;
    }

    function is_empty<T>(arr: vector<T>): bool {
      return len arr == 0;
    }

    function create<T>(n: byte): vector<T> {
      var v = new T[n];
      len v = 0;
      return v;
    }

    function from_array<T>(arr: vector<T>): vector<T> {
      var v = new T[capacity arr];
      len v = len arr;
      for(var i = 0; i < len v; i = i + 1){
        v[i] = arr[i];
      }
      return v;
    }

    function add<T>(vec: * vector<T>, element: T): void {
      if(len *vec == capacity *vec){
        _increase_capacity(vec);
      }
      var i = len *vec;
      len *vec = i + 1;
      (*vec)[i] = element;
    }

    function remove<T>(vec: vector<T>, index: byte): void {
      var n = len vec - 1;
      for(var i = index; i < n; i = i + 1){
        v[i] = v[i + 1];
      }
      len vec = n;
    }

    function find<T>(vec: vector<T>, el: T): byte {
      for(var i = 0; i < len vec; i = i + 1){
        if(el == vec[i]){
          return i;
        }
      }
      return -1;
    }

    function foreach<T>(vec: vector<T>, fn: (T) => void): void {
      for(var i = 0; i < len vec; i = i + 1){
        fn(vec[i]);
      }
    }
  }

  namespace string {
    function reverse(buffer: string): void {
      var length = len buffer;
      for(var i = 0; i < length / 2; i = i + 1){
        var c = buffer[i];
        buffer[i] = buffer[length - 1 - i];
        buffer[length - 1 - i] = c;
      }
    }

    function ntoa(number: byte, buffer: string, base: byte, allowNegative: bool): bool {
      len buffer = capacity buffer;

      // We always need at least 1 byte.
      if(capacity buffer < 1){
        return false;
      }

      var negative = false;
      if(allowNegative && number < 0){
        negative = true;
        number = -number;
      }

      var i = 0;
      while(number != 0){
        var remainder = number % base;
        buffer[i] = remainder > 9 ?
          remainder - 10 + 97 :
          remainder + 48;
        i = i + 1;

        if(i >= len buffer){
          return false;
        }

        number = number / base;
      }

      // Handle 0.
      if(i == 0){
        buffer[i] = 48;
        i = i + 1;
      }

      // Sign.
      if(negative){
        if(i >= len buffer){
          return false;
        }
        buffer[i] = 45;
        i = i + 1;
      }

      // Truncate.
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

  // Buffered IO.
  namespace buffered {
    .constant global READY: byte = 0x0;
    .constant global WRITE: byte = 0x1;
    .constant global READ: byte = 0x2;
    .constant global PENDING: byte = 0x3;
    .constant global ERROR: byte = 0x4;

    function write(control: * byte, buffer: string, data: string): bool {
      len buffer = len data;
      for(var i = 0; i < len data; i = i + 1){
        buffer[i] = data[i];
      }

      *control = WRITE;

      while(*control == PENDING){}

      return *control == READY;
    }

    function read(control: * byte, buffer: string, data: string): bool {
      *control = READ;

      while(*control == PENDING){}
      if(*control != READY){
        return false;
      }

      len data = len buffer;
      for(var i = 0; i < len buffer; i = i + 1){
        data[i] = buffer[i];
      }
      return true;
    }
  }

  // Formatted console IO.
  namespace console {
    function print(s: string): bool {
      var control: *byte = <unsafe * byte> 0x303;
      var buffer: string = <unsafe string> 0x304;
      return buffered::write(control, buffer, s);
    }

    function input(s: string): bool {
      var control = <unsafe * byte> 0x403;
      var buffer = <unsafe string> 0x404;
      return buffered::read(control, buffer, s);
    }
  }
}
