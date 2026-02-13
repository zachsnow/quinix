///////////////////////////////////////////////////////////////////////
// Interrupts.
///////////////////////////////////////////////////////////////////////
global LIB_INT_RELEASE = 0x0;
function _lib_int(int: byte): void;

///////////////////////////////////////////////////////////////////////
// Peripherals.
///////////////////////////////////////////////////////////////////////
type LIB_PERIPHERALS_TABLE_ENTRY = struct {
    var identifier: byte;
    var address: * byte;
}

global LIB_PERIPHERALS_TABLE_PTR: * LIB_PERIPHERALS_TABLE_ENTRY;

type LIB_PERIPHERAL_INIT_TABLE_ENTRY = struct {
    identifier: byte;
    init: (byte *) => void;
}

global LIB_PERIPHERAL_INIT_TABLE: * LIB_PERIPHERAL_INIT_TABLE_ENTRY = [
    {
        identifier=LIB_CONSOLE_IDENTIFIER,
        init=_lib_init_console,
    },
];

global _lib_init_peripherals(): void{
    var p: LIB_PERIPHERALS_TABLE_ENTRY * = LIB_PERIPHERALS_TABLE_PTR;
    while(p){
        var identifier = (*p).identifier;
        _lib_init_peripheral()
    }
    for()
}

//
// Buffered peripherals.
//
struct LIB_BUFFERED_PERIPHERAL_DATA = {
    control: byte;
    buffer: byte *;
}

global _LIB_BUFFERED_COMPLETE: byte = 0x0;
global _LIB_BUFFERED_PENDING: byte = 0x2;
global _LIB_BUFFERED_ERROR: byte = 0xffffffff;

global _LIB_BUFFERED_READ: byte = 0x1;
global _LIB_BUFFERED_WRITE: byte = 0x1;

function _lib_buffered_wait(byte * control){
    while(true){
        if(*control != _LIB_BUFFERED_PENDING){
            return;
        }
        _lib_int(INT_RELEASE);
    }
}

function _lib_buffered_output(byte * output, byte * buffer, byte * control){
    if(!data || !buffer || !control){
        return;
    }

    // First, copy over the data.
    var i: byte = 0;
    var c: byte = data[i];
    while(c){
        buffer[i] = c;
        i = i + 1;
        c = data[i];
    }

    // Next, trigger output.
    *control = WRITE;

    // Wait for completion.
    _lib_buffered_wait(control);
}

function _lib_buffered_input(byte * buffer, byte * input, byte n, byte * control){
    if(!data || !buffer || !control){
        return;
    }

    // Trigger a read and wait for it.
    *control = _LIB_BUFFERED_READ;
    _lib_buffered_wait(control);

    // Copy input.
    var i: byte = 0;
    var c: byte = buffer[0];
    while(c){
        data[i] = c;
        i = i + 1;
        c = buffer[i];
    }
}

//
// Debug output.
//
global LIB_DEBUG_OUTPUT_IDENTIFIER: byte = 0x1;
global LIB_DEBUG_OUTPUT_PTR: LIB_BUFFERED_PERIPHERAL_DATA * = 0x0;

function _lib_init_debug_output(entry: LIB_PERIPHERALS_TABLE_ENTRY *): void {
    LIB_DEBUG_OUTPUT_PTR = (*entry).address;
}

//
// Debug input.
//
global LIB_DEBUG_INPUT_IDENTIFIER: byte = 0x2;
global LIB_DEBUG_INPUT_PTR: LIB_BUFFERED_PERIPHERAL_DATA * = 0x0;

function _lib_init_debug_input(entry: LIB_PERIPHERALS_TABLE_ENTRY *): void {
    LIB_DEBUG_INPUT_PTR = (*entry).address;
}


///////////////////////////////////////////////////////////////////////
// Standard library.
///////////////////////////////////////////////////////////////////////
function lib_init(): void {
    _lib_init_peripheralss();
}

function lib_copy(dst: byte *, src: byte *, n: byte){
    if(!dst || !src){

    }
    var i: byte = 0;
    var c: byte = src[0];
    while(c && i < n){
        dst[i] = c;
        i = i + 1;
        c = src[i];
    }
}

function lib_debug_output(text: string) {
    _lib_buffered_output(text, (*LIB_DEBUG_OUTPUT_PTR).buffer, &(*LIB_DEBUG_OUTPUT_PTR).control);
}

function lib_debug_input(buffer: string, n: byte){
    _lib_buffered_input((*LIB_DEBUG_INPUT_PTR).buffer, text, n, &(*LIB_DEBUG_OUTPUT_PTR).control);
}
