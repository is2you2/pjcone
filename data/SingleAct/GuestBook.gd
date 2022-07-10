extends Node
# SC1 방명록 게시물 관리자

const HEADER:= 'SC1_GuestBook'
onready var _path:String = Root.html_path + 'assets/data/sc1_custom/Guest/guest_history.txt'
# 방명록 파일
var file:= File.new()

func _ready():
	var err:= file.open(_path, File.READ_WRITE)
	if err != OK:
		Root.logging(HEADER, str('load guestbook failed: ', err), Root.LOG_ERR)
	else:
		Root.logging(HEADER, str('Ready'))

# 파일 관리용 뮤텍스
var mutex:= Mutex.new()
# 새 글 적기
func write_content(data:String):
	mutex.lock()
	file.seek_end()
	file.store_line(data)
	file.flush()
	mutex.unlock()

# 게시물 편집하기
func modify_content(data:String):
	var _id:String = data.split(Root.SEP_CHAR)[0]
	print_debug(_id)
	mutex.lock()
	file.seek(0)
	var modified:= File.new()
	modified.open(Root.root_path + 'guest_history_work_tmp.txt', File.WRITE)
	var line:= file.get_csv_line(Root.SEP_CHAR)
	while not file.eof_reached():
		if _id == line[0]:
			modified.store_csv_line(data.split(Root.SEP_CHAR), Root.SEP_CHAR)
		else:
			modified.store_csv_line(line, Root.SEP_CHAR)
		line = file.get_csv_line(Root.SEP_CHAR)
	modified.flush()
	modified.close()
	file.close()
	var dir:= Directory.new()
	dir.rename(Root.root_path + 'guest_history_work_tmp.txt', _path)
	_ready()
	mutex.unlock()

# 게시물 삭제하기
func remove_content(id:String):
	mutex.lock()
	print_debug('데이터 받음: ', id)
	mutex.unlock()


func _exit_tree():
	file.flush()
	file.close()
