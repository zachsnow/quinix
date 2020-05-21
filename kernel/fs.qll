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
        return std::buffered::read(&peripherals::debug_input->control, peripherals::debug_input->buffer, data);
      }

      var index = std::vector::find_by(process->files, _find_file, handle);
      if(index == -1){
        return false;
      }
      var file = process->files[index];
      if(!std::buffered::write(&peripherals::debug_file->control, peripherals::debug_file->buffer, file.path)){
        return false;
      }
      return std::buffered::read(&peripherals::debug_file->control, peripherals::debug_file->buffer, data);
    }

    function write(handle: handle, data: byte[]): bool {
      var process = process::current_process();

      if(handle == handle::OUTPUT){
        return std::buffered::write(&peripherals::debug_output->control, peripherals::debug_output->buffer, data);
      }

      var index = std::vector::find_by(process->files, _find_file, handle);
      if(index == -1){
        return false;
      }
      var file = process->files[index];
      if(!std::buffered::write(&peripherals::debug_file->control, peripherals::debug_file->buffer, file.path)){
        return false;
      }
      return std::buffered::write(&peripherals::debug_file->control, peripherals::debug_file->buffer, data);
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

      destroy_file(process->files[i]);

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