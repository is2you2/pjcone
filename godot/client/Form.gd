## SPDX-FileCopyrightText: © 2023 그림또따 <is2you246@gmail.com>
## SPDX-License-Identifier: MIT

extends Node

# iframe 창
var window

var quit_godot_func = JavaScriptBridge.create_callback(quit_godot)
var modify_image_func = JavaScriptBridge.create_callback(modify_image)
var create_thumbnail_func = JavaScriptBridge.create_callback(create_thumbnail)
var start_load_pck_func = JavaScriptBridge.create_callback(start_load_pck)
var download_url_func = JavaScriptBridge.create_callback(download_url)

# 앱 시작과 동시에 동작하려는 pck 정보를 받아옴
func _ready():
	get_viewport().files_dropped.connect(load_package_debug)
	if OS.has_feature('JavaScript'):
		window = JavaScriptBridge.get_interface('window')
		window.quit_godot = quit_godot_func
		# ionic에게 IndexedDB가 생성되었음을 알림
		window.parent['godot'] = 'godot';
		window.modify_image = modify_image_func
		window.create_thumbnail = create_thumbnail_func
		window.start_load_pck = start_load_pck_func
		window.download_url = download_url_func

# 주소로부터 다운받기
func download_url(args):
	var dir:= DirAccess.open('user://')
	if not dir.dir_exists('user://tmp_files/') or not dir.dir_exists('user://tmp_files/duplicate'):
		dir.make_dir_recursive('user://tmp_files/duplicate/')
	var file:= FileAccess.open('user://tmp_files/duplicate/viewer.%s' % window.ext, FileAccess.WRITE)
	file.close()
	var http_req:= HTTPRequest.new()
	http_req.download_file = 'user://tmp_files/duplicate/viewer.%s' % window.ext
	add_child(http_req)
	http_req.connect("request_completed", Callable(self, 'download_complete'))
	http_req.request(window.url)

func download_complete(result, res_code, header, body):
	start_load_pck([])

# 로컬 파일로 즉시 시작
func start_load_pck(args):
	match(window['ext']):
		'pck':
			load_pck()
		'blend':
			pass
		'obj':
			pass
		'stl':
			pass
		'glb':
			pass
		'gltf':
			# 파일읽기 준비중 알림
			$CenterContainer/Label.text = 'Preparing open file ext:\n%s' % window['ext']
		_: # 예외처리
			$CenterContainer/Label.text = 'Cannot open file:\n%s' % ('user://%s' % window['path'])

# pck 투척시 테스트를 위해 바로 받아보기
func load_package_debug(files:PackedStringArray):
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
	get_viewport().files_dropped.disconnect(load_package_debug)


func load_pck(try_left:= 5):
	var dir:=DirAccess.open('user://')
	if dir.file_exists('user://%s' % window['path']):
		var is_loaded:= ProjectSettings.load_resource_pack('user://%s' % window['path'])
		if not is_loaded: # 없으면 다운받기
			printerr('Godot: 패키지를 불러오지 못함: ', 'user://%s' % window['path'])
			$CenterContainer/ColorRect/Label.text = 'Cannot open file: %s' % 'user://%s' % window['path']
		else: # 패키지를 가지고 있는 경우
			$CenterContainer.queue_free()
			load_next_scene('res://ContentViewer.tscn')
			if get_tree().is_connected("files_dropped", Callable(self, 'load_package_debug')):
				get_tree().disconnect("files_dropped", Callable(self, 'load_package_debug'))
	else:
		if try_left > 0:
			await get_tree().idle_frame
			load_pck(try_left - 1)
		else:
			printerr('Godot: 패키지를 불러오지 못함: ', 'user://%s' % window['path'])
			$CenterContainer/ColorRect/Label.text = 'Cannot open file: %s' % 'user://%s' % window['path']

# 천천히 불러오기
func load_next_scene(path:String, targetNode:Node = self):
	ResourceLoader.load_threaded_request(path)
	var progress:= [0]
	while progress[0] == 1:
		ResourceLoader.load_threaded_get_status(path, progress)
		if OS.has_feature('JavaScript') and window.update_load:
			window.update_load(progress[0], 1)
		await get_tree().physics_frame
	# 로딩이 종료되고나면
	if OS.has_feature('JavaScript') and window.update_load:
		window.update_load(1, 1)
	await get_tree().create_timer(.4).timeout
	var _resource:= ResourceLoader.load_threaded_get(path)
	var _inst = _resource.instantiate()
	targetNode.add_child(_inst)


func modify_image(args):
	var viewport:SubViewport = get_viewport()
	var img:= viewport.get_texture().get_image()
	img.flip_y()
	var buf:= img.save_png_to_buffer()
	window.receive_image(Marshalls.raw_to_base64(buf), img.get_width(), img.get_height())


func create_thumbnail(args):
	var dir:= DirAccess.open('user://')
	var thumbnail_exist:= dir.file_exists('%s_thumbnail.png' % [window.path])
	if not thumbnail_exist:
		var viewport:Viewport = get_viewport()
		var img:= viewport.get_texture().get_image()
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
