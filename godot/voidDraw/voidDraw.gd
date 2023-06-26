extends Node


var new_canvas_func = JavaScript.create_callback(self, 'new_canvas')
var open_color_selector_func = JavaScript.create_callback(self, 'open_color_selector')


func _ready():
	if OS.has_feature('JavaScript'):
		var window = JavaScript.get_interface('window')
		window.new_canvas = new_canvas_func
		window.change_color = open_color_selector_func
		var json = {
			'width': 432,
			'height': 432,
		}
		if not window.image:
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
		child.queue_free()
	var json = JSON.parse(args[0]).result
	if json is Dictionary:
		var tex:ImageTexture
		if json.has('path'): # 배경 이미지 포함시
			var img:= Image.new()
			img.load(json.path)
			tex = ImageTexture.new()
			tex.create_from_image(img)
		inst = draw_panel.instance()
		inst.width = json.width
		inst.height = json.height
		inst.is_modify = json.has('path')
		if tex: inst.BaseTexture = tex
		add_child(inst)
	else: printerr('voidDraw: json import error')


onready var color_picker = get_node('../ColorPicker')


func open_color_selector(args):
	color_picker.visible = true
	color_picker.selectedColor = inst.DrawBrush.color
	inst.DrawViewport.gui_disable_input = true

func set_line_color():
	color_picker.visible = false
	inst.DrawBrush.color = color_picker.selectedColor
	inst.DrawViewport.gui_disable_input = false
