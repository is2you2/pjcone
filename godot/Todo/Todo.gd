## SPDX-FileCopyrightText: © 2023 그림또따 <is2you246@gmail.com>
## SPDX-License-Identifier: MIT

extends Node

# iframe 창
var window
var add_todo_func = JavaScript.create_callback(self, 'add_todo')

# 앱 시작과 동시에 동작하려는 pck 정보를 받아옴
func _ready():
	# 구성 폴더가 없으면 폴더 생성
	var dir:= Directory.new()
	if not dir.dir_exists('user://todo/'):
		dir.make_dir('user://todo/')
	if dir.open('user://todo/') == OK:
		dir.list_dir_begin(true, true)
		var ls = dir.get_next()
		while ls:
			print_debug('여기행동: ', ls)
			ls = dir.get_next()
		dir.list_dir_end()
	if OS.has_feature('JavaScript'):
		window = JavaScript.get_interface('window')
		window.add_todo = add_todo_func
	else: # 엔진에서 테스트중일 때
		pass

# 해야할 일 추가하기
func add_todo(args):
	var json = JSON.parse(args[0]).result
	if json is Dictionary:
		print_debug('data: json_', json['title'])
	else: print_debug('data: else')

# 해야할 일 추가하기 페이지 띄우기 (ionic-modal)
func _on_add_pressed():
	if OS.has_feature('JavaScript'):
		window.add_todo_menu()
	else: print_debug('웹앱에서 테스트 필요')
