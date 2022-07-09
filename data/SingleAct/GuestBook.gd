extends Node
# SC1 방명록 게시물 관리자

const HEADER:= 'SC1_GuestBook'
onready var _path:String = get_parent().get_parent().html_path + 'assets/data/sc1_custom/Guest/guest_history.txt'
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
	mutex.lock()
	print_debug('데이터 받음: ', data)
	mutex.unlock()

# 게시물 삭제하기
func remove_content(id:String):
	mutex.lock()
	print_debug('데이터 받음: ', id)
	mutex.unlock()


func _exit_tree():
	file.flush()
	file.close()
