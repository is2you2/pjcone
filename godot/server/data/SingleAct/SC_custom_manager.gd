extends Node
# 폴더를 올려 내부 파일 리스트를 새로고침하여 리스트 파일을 출력합니다

const HEADER:= 'SC1_list'

func _ready():
	refresh_list()

# 이미지 리스트 업데이트
func refresh_list():
	var dir:= Directory.new()
	var _path:String = Root.html_path + 'assets/data/sc1_custom/'
	var err:= dir.open(_path)
	if err == OK:
		dir.list_dir_begin(true, true)
		var _file:= dir.get_next()
		while _file:
			if dir.current_is_dir():
				catch_all_files(_path, str(_file))
				catch_downloads(_path, str(_file))
			_file = dir.get_next()
		Root.logging(HEADER, str('list_refreshed'))
	else: # 폴더찾기 실패시
		Root.logging(HEADER, str('list dir failed: ', err, '... Path info: ', _path), Root.LOG_ERR)

# 폴더를 올리면 내부 파일을 리스트화 시켜서 돌려줌 (직접 생성시)
func catch_all_files(path:String, target:String):
	var dir:= Directory.new()
	var err:= dir.open(path + target + '/Screenshots/')
	var lists:= {}
	if err == OK: # 폴더일 때
		lists['files'] = []
		dir.list_dir_begin(true, true)
		var _file:= dir.get_next()
		while _file:
			lists['files'].push_back(_file)
			_file = dir.get_next()
		dir.list_dir_end()
		lists['files'].sort()
		var file:= File.new()
		var fer:= file.open(path + target + '/list.json', File.WRITE)
		if fer == OK:
			file.store_string(JSON.print(lists))
		else:
			Root.logging(HEADER, str('create %s list.json failed: ' % target, fer), Root.LOG_ERR)
		file.flush()
		file.close()
	else:
		Root.logging(HEADER, str('catch_all_files failed: ', err))

# 다운로드 가능한 맵 파일 추려내기
func catch_downloads(path:String, target:String):
	var dir:= Directory.new()
	var err:= dir.open(path + target)
	if err == OK:
		dir.list_dir_begin(true, true)
		var list:= []
		var _file:= dir.get_next()
		while _file:
			if (_file.find_last('.scx') + 1) or (_file.find_last('.scm') + 1):
				list.push_back(_file)
			_file = dir.get_next()
		dir.list_dir_end()
		list.sort()
		var file:= File.new()
		var fer:= file.open(path + target + '/list.txt', File.WRITE)
		if fer == OK:
			for line in list:
				file.store_line(line)
			file.flush()
			file.close()
		else:
			Root.logging(HEADER, str('create %s list failed: ' % target, fer), Root.LOG_ERR)
	else:
		Root.logging(HEADER, str('catch download error: ', err), Root.LOG_ERR)
