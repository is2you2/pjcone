extends Node

# iframe 창
var window

var quit_godot_func = JavaScript.create_callback(self, 'quit_godot')
var modify_image_func = JavaScript.create_callback(self, 'modify_image')
var create_thumbnail_func = JavaScript.create_callback(self, 'create_thumbnail')
var start_load_pck_func = JavaScript.create_callback(self, 'start_load_pck')
var download_url_func = JavaScript.create_callback(self, 'download_url')

# 앱 시작과 동시에 동작하려는 pck 정보를 받아옴
func _ready():
	get_tree().connect("files_dropped", self, 'load_package_debug')
	if OS.has_feature('JavaScript'):
		window = JavaScript.get_interface('window')
		window.quit_godot = quit_godot_func
		# ionic에게 IndexedDB가 생성되었음을 알림
		window.parent['godot'] = 'godot';
		var dir:= Directory.new()
		window.modify_image = modify_image_func
		window.create_thumbnail = create_thumbnail_func
		window.start_load_pck = start_load_pck_func
		window.download_url = download_url_func

# 주소로부터 다운받기
func download_url(args):
	var dir:= Directory.new()
	if not dir.dir_exists('user://tmp_files/') or not dir.dir_exists('user://tmp_files/duplicate'):
		dir.make_dir_recursive('user://tmp_files/duplicate/')
	var file:= File.new()
	file.open('user://tmp_files/duplicate/viewer.%s' % window.ext, File.WRITE)
	file.close()
	var http_req:= HTTPRequest.new()
	http_req.download_file = 'user://tmp_files/duplicate/viewer.%s' % window.ext
	add_child(http_req)
	http_req.connect("request_completed", self, 'download_complete')
	http_req.request(window.url)

func download_complete(result, res_code, header, body):
	start_load_pck([])

# 로컬 파일로 즉시 시작
func start_load_pck(args):
	load_pck()

# pck 투척시 테스트를 위해 바로 받아보기
func load_package_debug(files:PoolStringArray, scr):
	var target:String
	for file in files:
		if file.find('.pck') + 1:
			target = file
			break
	var is_loaded:= ProjectSettings.load_resource_pack(target, false)
	if not is_loaded: # 불러오기 실패
		printerr('Godot: 패키지를 불러오지 못함: ', target)
	else: # 정상적으로 불러와짐
		$CenterContainer.queue_free()
		print('Godot-debug: 패키지 타겟: ', target)
		load_next_scene('res://ContentViewer.tscn')
	get_tree().disconnect("files_dropped", self, 'load_package_debug')


func load_pck(try_left:= 5):
	var dir:=Directory.new()
	if dir.file_exists('user://%s' % window['path']):
		var is_loaded:= ProjectSettings.load_resource_pack('user://%s' % window['path'])
		if not is_loaded: # 없으면 다운받기
			printerr('Godot: 패키지를 불러오지 못함: ', 'user://%s' % window['path'])
			$CenterContainer/ColorRect/Label.text = 'Cannot open file: %s' % 'user://%s' % window['path']
		else: # 패키지를 가지고 있는 경우
			$CenterContainer.queue_free()
			load_next_scene('res://ContentViewer.tscn')
			if get_tree().is_connected("files_dropped", self, 'load_package_debug'):
				get_tree().disconnect("files_dropped", self, 'load_package_debug')
	else:
		if try_left > 0:
			yield(get_tree(), "idle_frame")
			load_pck(try_left - 1)
		else:
			printerr('Godot: 패키지를 불러오지 못함: ', 'user://%s' % window['path'])
			$CenterContainer/ColorRect/Label.text = 'Cannot open file: %s' % 'user://%s' % window['path']

# 천천히 불러오기
func load_next_scene(path:String, targetNode:Node = self):
	var _loader:= ResourceLoader.load_interactive(path)
	var current:int
	var length:int = _loader.get_stage_count()
	var _err:= _loader.poll()
	while _err == OK:
		_err = _loader.poll()
		current = _loader.get_stage()
		if OS.has_feature('JavaScript') and window.update_load:
			window.update_load(current, length)
		yield(get_tree(), "physics_frame")
	# 로딩이 종료되고나면
	if _err == ERR_FILE_EOF:
		if OS.has_feature('JavaScript') and window.update_load:
			window.update_load(length, length)
		yield(get_tree().create_timer(.4), "timeout")
		var _resource:= _loader.get_resource()
		var _inst = _resource.instance()
		targetNode.add_child(_inst)
	else:
		printerr('예상치 못한 이유로 씬 로드 오류 발생: ', _err)


func modify_image(args):
	var viewport:Viewport = get_viewport()
	var img:= viewport.get_texture().get_data()
	img.flip_y()
	var buf:= img.save_png_to_buffer()
	window.receive_image(Marshalls.raw_to_base64(buf), img.get_width(), img.get_height())


func create_thumbnail(args):
	var dir:= Directory.new()
	var thumbnail_exist:= dir.file_exists('%s_thumbnail.png' % [window.path])
	if not thumbnail_exist:
		var viewport:Viewport = get_viewport()
		var img:= viewport.get_texture().get_data()
		img.flip_y()
		var width:= img.get_width()
		var height:= img.get_height()
		if width < height:
			img.resize(float(width) / float(height) * 192, 192)
		else: img.resize(192, float(height) / float(width) * 192)
		var buf:= img.save_png_to_buffer()
		window.create_thumbnail_p5(Marshalls.raw_to_base64(buf), args[0])


func quit_godot(args):
	get_tree().quit()
