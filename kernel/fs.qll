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
      if(handle == handle::INPUT){
        return std::buffered::read(debug_input->control, debug_input->buffer, data);
      }

      var index = std::vector::find_by(process->files, _find_file, handle);
      if(index == -1){
        return false;
      }
      var file = process->files[index];
      if(!std::buffered::write(debug_file->control, debug_file->buffer, file->path)){
        return false;
      }
      return std::buffered::read(debug_file->control, debug_file->buffer, data);
    }

    function write(handle: handle, data: byte[]): byte {
      if(handle == handle::OUTPUT){
        return std::buffered::write(debug_output->control, debug_output->buffer, data);
      }

      var index = std::vector::find_by(process->files, _find_file, handle);
      if(index == -1){
        return false;
      }
      var file = process->files[index];
      if(!std::buffered::write(debug_file->control, debug_file->buffer, file->path)){
        return false;
      }
      return std::buffered::write(debug_file->control, debug_file->buffer, data);
    }

    function open(path: string): handle {
      // Just creates a `file` with the given path. Since we want
      // this to be cleaned up when the process is cleaned up, we
      // store it with the process.
      var process = process::current_process();

      // Be sure to copy the path because it's a string that lives
      // in the memory of the calling process.
      std::vector::add(&process->files, file {
        path = str::from_string(path),
        handle = handle::id,
      });

      handle::id = handle::id + 1;
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
      return std::vector::create<file>(2);
    }

    function destroy_files(files: files): void {
      std::vector::foreach(files, _destroy_file);
      std::vector::destroy(files);
    }

    function init(): void {}
  }
}