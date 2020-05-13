// Is this invalid, or is the instantiation of it invalid?
// A recursive use of a type isn't always invalid; for instance,
// if the recursive use instantiates the type at a different type
// (that is "smaller" than the original type).
//
type t<T> = t<T>;
type i = t<int>;

// This is clearly valid.
type list<T> = struct {
  element: T;
  next: * list<T>;
};

type byte_list = list<byte>;
