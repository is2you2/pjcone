extends Node


signal save_image


var window # iframe 창
var new_canvas_func = JavaScript.create_callback(self, 'new_canvas')
var set_line_weight_func = JavaScript.create_callback(self, 'set_line_weight')
var save_image_func = JavaScript.create_callback(self, 'save_image')


func _ready():
	if OS.has_feature('JavaScript'):
		window = JavaScript.get_interface('window')
		window.new_canvas = new_canvas_func
		window.save_image = save_image_func
		window.set_line_weight = set_line_weight_func
		var json = {
			'width': 432,
			'height': 432,
		}
		new_canvas([JSON.print(json)])
	else:
		print_debug('on test...')
		var json = {
			'width': 432,
			'height': 768,
		}
		new_canvas([JSON.print(json)])
		yield(get_tree().create_timer(5), "timeout")


const draw_panel:= preload("res://DrawPanel.tscn")
# 그림판 노드
var inst:ViewportContainer


# 새 캔버스 생성하기
func new_canvas(args):
	# 기존에 존재하는 캔버스를 삭제 후 새로 생성함
	var children:= get_children()
	for child in children:
		if is_connected("save_image", child, 'save_image'):
			disconnect("save_image", child, 'save_image')
		child.queue_free()
	var json = JSON.parse(args[0]).result
	if json is Dictionary:
		var tex:ImageTexture
		if json.has('image'): # 배경 이미지 포함시
			var data64:= Marshalls.base64_to_raw(json.image)
			var img:= Image.new()
			match(json.img_ext):
				'png':
					img.load_png_from_buffer(data64)
				'jpg':
					img.load_jpg_from_buffer(data64)
				'webp':
					img.load_webp_from_buffer(data64)
				_:
					printerr('voidDraw_올바르지 않은 이미지 형식: ', json.img_ext)
			tex = ImageTexture.new()
			tex.create_from_image(img)
		inst = draw_panel.instance()
		inst.width = json.width
		inst.height = json.height
		connect("save_image", inst, 'save_image')
		if tex: inst.BaseTexture = tex
		inst.connect('save_as_png', self, 'use_canvas')
		add_child(inst)
	else: printerr('voidDraw: json import error')


# 이미지 저장하기 통로
func save_image(_args):
	emit_signal("save_image")


func set_line_color(args):
	print_debug('색상 변경: ', args)


func set_line_weight(args):
	inst.set_line_weight(args[0])


# 지금 그려진 그림을 사용하기
func use_canvas(base64:String):
	if OS.has_feature('JavaScript'):
		window.receive_image(base64)
	else:
		print_debug('이미지 사용하기: ', base64)
