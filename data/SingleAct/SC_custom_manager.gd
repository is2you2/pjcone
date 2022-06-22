extends Node
# 폴더를 올려 내부 파일 리스트를 json으로 돌려줍니다.
# Starcraft-custom 에서 이미지 리스트를 받기위해 생성됨
# 게스트 액션 허용

const HEADER:= 'SC1_custom'
# 캠페인별 스크린샷 파일 리스트 일람
var lists:= {}


func _ready():
	refresh_list()


# 이미지 리스트 업데이트
func refresh_list():
	var dir:= Directory.new()
	lists.clear()
	var _path:String = get_parent().html_path + 'assets/data/sc1_custom/'
	var err:= dir.open(_path)
	if err == OK:
		dir.list_dir_begin(true, true)
		var _file:= dir.get_next()
		while _file:
			if dir.current_is_dir():
				var target:= str(_file)
				catch_all_files(_path + target + '/Screenshots/', target)
			_file = dir.get_next()
	else: # 폴더찾기 실패시
		Root.log(HEADER, str('list dir failed: ', err), Root.LOG_ERR)

# 폴더를 올리면 내부 파일을 리스트화 시켜서 돌려줌 (직접 생성시)
func catch_all_files(path:String, target:String):
	var dir:= Directory.new()
	var err:= dir.open(path)
	if err == OK: # 폴더일 때
		lists[target] = []
		dir.list_dir_begin(true, true)
		var _file:= dir.get_next()
		while _file:
			lists[target].push_back(_file)
			_file = dir.get_next()
		dir.list_dir_end()
	else:
		Root.log(HEADER, str('catch_all_files failed: ', err))


# 메시지를 수신받아서 이미지 리스트 액션 취하기
func received(id:int, data:Dictionary):
	print_debug('sc1_custom receive: ', id, '/', data)
	get_parent().send_to(id, 'Hello'.to_utf8())