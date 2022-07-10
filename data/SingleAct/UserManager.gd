extends Node
# 서버 내 사용자 관련 데이터베이스 관리용
# 사용자 생성, 검토, 편집, 삭제

# 사용자 DB 메인 경로 (uid 모음)
onready var _path:String = Root.root_path + 'users.csv'
const HEADER:= 'UserManager'

# 파일 포인팅, 등록된 모든 사용자
# csv form: 이메일, uuid, uuid2, ...
var file:= File.new()
# 사용자 파일 오류 방지용
var mutex:= Mutex.new()

func _ready():
	var dir:= Directory.new()
	read_user_list(dir.file_exists(_path))

# 사용자 파일 지정해두기
func read_user_list(_is_new:= false):
	var err:int
	if _is_new: # 파일 있으면 읽기쓰기 모드
		err = file.open(_path, File.READ_WRITE)
	else: # 파일이 없으면 생성하기
		err = file.open(_path, File.WRITE)
	if err == OK:
		Root.logging(HEADER, str('OpenUserList Well'))
		file.seek_end()
	else: # 파일 열기 오류시
		Root.logging(HEADER, str('OpenUserList Error: ', err), Root.LOG_ERR)

# 사용자 찾기 / return 사용자유무
func find_user(email:String, uuid:= '') -> bool:
	file.seek(0)
	var line:= file.get_csv_line(Root.SEP_CHAR)
	var has_email:bool
	while not file.eof_reached():
		if Array(line).find(email) + 1:
			has_email = true
			break
		line = file.get_csv_line(Root.SEP_CHAR)
	if has_email and not uuid:
		return true
	return bool(Array(line).find(uuid) + 1)

# 사용자 검토 / return 성공여부
func login_user(email:String) -> bool:
	return false

# 사용자 정보 수정 / return 수정여부
func modify_user(email:int) -> bool:
	return false

# 사용자 삭제 / return 삭제여부
func remove_user(email:int) -> bool:
	return false

# 서버가 종료될 때 모든 파일 정상 종료 후 닫기
func _exit_tree():
	file.flush()
	file.close()
