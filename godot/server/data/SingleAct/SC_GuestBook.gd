extends Node
# SC1 방명록 게시물 관리자

const HEADER:= 'SC1_GuestBook'
onready var _path:String = Root.html_path + 'assets/data/sc1_custom/Guest/guest_history.txt'
onready var _tmp_path:String = Root.html_path + 'assets/data/sc1_custom/Guest/guest_history.tmp'
# 방명록 파일
var file:= File.new()

# git에 반영되지 않은 정보 캐싱
var wrote:= []
var modified:= []
var removed:= []

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
	wrote.push_back(data)
	mutex.unlock()

# 게시물 편집하기
func modify_content(data:String):
	var _id:String = data.split(Root.SEP_CHAR)[0]
	mutex.lock()
	file.seek(0)
	var _modified:= File.new()
	var err:= _modified.open(_tmp_path, File.WRITE)
	if err == OK:
		var line:= file.get_csv_line(Root.SEP_CHAR)
		while not file.eof_reached():
			if _id == line[0]: # 수정 대상이면 교체
				var _data:= data.split(Root.SEP_CHAR)
				_modified.store_csv_line(_data, Root.SEP_CHAR)
				for i in range(modified.size()):
					var check:PoolStringArray = modified[i].split(Root.SEP_CHAR)
					if check[0] == _data[0]:
						modified.remove(i)
				modified.push_back(data)
			else: # 수정 대상이 아니면 기존 데이터 사용
				_modified.store_csv_line(line, Root.SEP_CHAR)
			line = file.get_csv_line(Root.SEP_CHAR)
	else:
		Root.logging(HEADER, str('modify guestbook content failed: ', err), Root.LOG_ERR)
	_modified.flush()
	_modified.close()
	var dir:= Directory.new()
	dir.rename(_tmp_path, _path)
	_ready()
	mutex.unlock()

# 게시물 삭제하기
func remove_content(id:String):
	mutex.lock()
	file.seek(0)
	var modified:= File.new()
	var err:= modified.open(_tmp_path, File.WRITE)
	if err == OK:
		var line:= file.get_csv_line(Root.SEP_CHAR)
		while not file.eof_reached():
			if id == line[0]:
				if not removed.has(id):
					removed.push_back(id)
			else:
				modified.store_csv_line(line, Root.SEP_CHAR)
			line = file.get_csv_line(Root.SEP_CHAR)
	else:
		Root.logging(HEADER, str('remove guestbook content failed: ', err), Root.LOG_ERR)
	modified.flush()
	modified.close()
	var dir:= Directory.new()
	dir.rename(_tmp_path, _path)
	_ready()
	# 캐시에서 수정
	
	mutex.unlock()


func _exit_tree():
	file.flush()
	file.close()
