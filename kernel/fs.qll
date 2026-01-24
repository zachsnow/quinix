namespace kernel {
  namespace fs {
    type handle = byte;
    namespace handle {
      .constant global OUTPUT: handle = 0x1;
      .constant global INPUT: handle = 0x2;
      global id: handle = 0x3;
    }

    type file = struct {
      path: string;
      handle: handle;
    };

    type files = std::vector<file>;

    function _find_file(file: file, handle: handle): bool {
      return file.handle == handle;
    }

    function read(handle: handle, data: byte[]): bool {
      var process = process::current_process();

      if(handle == handle::INPUT){
        return std::buffered::read(
          &peripherals::debug_input->control,
          &peripherals::debug_input->size,
          &peripherals::debug_input->buffer[unsafe 0],
          data
        );
      }

      var index = std::vector::find_by(process->files, _find_file, handle);
      if(index == -1){
        return false;
      }
      var file = process->files[index];
      if(!std::buffered::write(
        &peripherals::debug_file->control,
        &peripherals::debug_file->size,
        &peripherals::debug_file->buffer[unsafe 0],
        file.path
      )){
        return false;
      }
      return std::buffered::read(
        &peripherals::debug_file->control,
        &peripherals::debug_file->size,
        &peripherals::debug_file->buffer[unsafe 0],
        data
      );
    }

    // Write a single byte to a handle (used by syscalls)
    function write_byte(handle: handle, ch: byte): bool {
      if(handle == handle::OUTPUT){
        // Write directly to debug output buffer
        peripherals::debug_output->buffer[unsafe 0] = ch;
        peripherals::debug_output->size = 1;
        peripherals::debug_output->control = std::buffered::WRITE;
        while(peripherals::debug_output->control == std::buffered::PENDING){}
        return peripherals::debug_output->control == std::buffered::READY;
      }
      // For other handles, not implemented
      return false;
    }

    function write(handle: handle, data: byte[]): bool {
      var process = process::current_process();

      if(handle == handle::OUTPUT){
        return std::buffered::write(
          &peripherals::debug_output->control,
          &peripherals::debug_output->size,
          &peripherals::debug_output->buffer[unsafe 0],
          data
        );
      }

      var index = std::vector::find_by(process->files, _find_file, handle);
      if(index == -1){
        return false;
      }
      var file = process->files[index];
      if(!std::buffered::write(
        &peripherals::debug_file->control,
        &peripherals::debug_file->size,
        &peripherals::debug_file->buffer[unsafe 0],
        file.path
      )){
        return false;
      }
      return std::buffered::write(
        &peripherals::debug_file->control,
        &peripherals::debug_file->size,
        &peripherals::debug_file->buffer[unsafe 0],
        data
      );
    }

    function open(path: string): handle {
      // Just creates a `file` with the given path. Since we want
      // this to be cleaned up when the process is cleaned up, we
      // store it with the process.
      var process = process::current_process();

      // Assign the file a handle.
      var h = handle::id;
      handle::id = handle::id + 1;

      // Be sure to copy the path because it's a string that lives
      // in the memory of the calling process.
      std::vector::add(&process->files, file {
        path = std::str::from_string(path),
        handle = h,
      });

      return h;
    }

    function close(handle: handle): void {
      var process = process::current_process();
      var i = std::vector::find_by(process->files, _find_file, handle);
      if(i == -1){
        return;
      }

      _destroy_file(process->files[i]);

      std::vector::remove(process->files, i);
    }

    function _destroy_file(file: file): void {
      delete file.path;
    }

    function create_files(): files {
      return <files>std::vector::create<file>(2);
    }

    function destroy_files(files: files): void {
      std::vector::foreach(files, _destroy_file);
      std::vector::destroy(files);
    }

    function init(): void {}
  }
}