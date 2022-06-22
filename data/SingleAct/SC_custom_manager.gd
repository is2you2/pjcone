extends Node
# 폴더를 올려 내부 파일 리스트를 json으로 돌려줍니다.
# Starcraft-custom 에서 이미지 리스트를 받기위해 생성됨
# 게스트 액션 허용

var json:Dictionary = {}

func _ready():
	get_tree().connect("files_dropped",self,"catch_drag_drop_folder")

# 폴더를 올리면 내부 파일을 리스트화 시켜서 돌려줌 (직접 생성시)
func catch_drag_drop_folder(_folders:PoolStringArray, _scr:int):
	for folder in _folders:
		var dir:= Directory.new()
		var err:= dir.open(folder)
		if err == OK: # 폴더일 때
			json.clear() # 새로운 작업처리
			json['root'] = folder + '/'
			json['files'] = []
			dir.list_dir_begin(true, true)
			var _file:= dir.get_next()
			while _file:
				json['files'].push_back(_file)
				_file = dir.get_next()
				yield(get_tree(), "physics_frame")
			dir.list_dir_end()
			var _index:int = folder.find_last('/')
			var root_path:String = folder.substr(0, _index + 1)
			var file:= File.new()
			if file.open(root_path + 'list.json', File.WRITE) == OK:
				file.store_string(JSON.print(json))
			file.close()
			break # 1개 폴더에 대해서만 동작


func _exit_tree():
	get_tree().disconnect("files_dropped",self,'catch_drag_drop_folder')


# 메시지를 수신받아서 이미지 리스트 액션 취하기
func _received(id:int):
	pass