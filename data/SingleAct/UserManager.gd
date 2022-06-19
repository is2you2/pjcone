extends Node
# 서버 내 사용자 관련 데이터베이스 관리용
# 사용자 생성, 검토, 편집, 삭제

# 사용자 DB 메인 경로 (uid 모음)
onready var _path:String = get_parent().root_path + 'users.csv'


# 현재 접속된 사용자, 유저 세션
var users:= []


# 사용자 생성
func create_user(server:WebSocketServer, id:int):
	pass

# 사용자 정보 수정
func modify_user(server:WebSocketServer, id:int):
	pass

# 사용자 삭제
func remove_user(server:WebSocketServer, id:int):
	pass

# 서버가 종료될 때 모든 파일 정상 종료 후 닫기
func _exit_tree():
	pass
