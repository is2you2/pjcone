## SPDX-FileCopyrightText: © 2023 그림또따 <is2you246@gmail.com>
## SPDX-License-Identifier: MIT

extends Node

# iframe 창
var window
var modify_image_func = JavaScript.create_callback(self, 'modify_image')

# 앱 시작과 동시에 동작하려는 pck 정보를 받아옴
func _ready():
	if OS.has_feature('JavaScript'):
		window = JavaScript.get_interface('window')
		window.modify_image = modify_image_func
		match(window['ext']):
			'pck':
				load_pck()
			'obj':
				continue
			'stl':
				continue
			'glb':
				continue
			'gltf':
				# 파일읽기 준비중 알림
				$CenterContainer/Label.text = 'Preparing open file ext:\n%s' % window['ext']
			_: # 예외처리
				$CenterContainer/Label.text = 'Cannot open file:\n%s' % ('user://%s' % window['path'])

func load_pck():
	var is_loaded:= ProjectSettings.load_resource_pack('user://%s' % window['path'], false)
	if not is_loaded: # 없으면 다운받기
		printerr('Godot: 패키지를 불러오지 못함: ', 'user://%s' % window['path'])
		$CenterContainer/Label.text = 'Cannot open file: %s' % 'user://%s' % window['path']
	else: # 패키지를 가지고 있는 경우
		$CenterContainer.queue_free()
		var inst = load('res://ContentViewer.tscn')
		add_child(inst.instance())

func modify_image(args):
	var viewport:Viewport = get_viewport()
	var img:= viewport.get_texture().get_data()
	img.flip_y()
	var buf:= img.save_png_to_buffer()
	var file:= File.new()
	var err:= file.open('user://tmp_modify_image.png', File.WRITE)
	if err == OK:
		file.store_buffer(buf)
	else: printerr('tmp_modify_image.png save err: ', err)
	file.close()
	if OS.has_feature('JavaScript'):
		window.receive_image('tmp_modify_image.png', img.get_width(), img.get_height())
