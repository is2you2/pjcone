extends Node


var window # iframe 창
var new_canvas_func = JavaScript.create_callback(self, 'new_canvas')


func _ready():
	if OS.has_feature('JavaScript'):
		window = JavaScript.get_interface('window')
		window.new_canvas = new_canvas_func
	else:
		print_debug('on test...')
		var json = {
			'width': 432,
			'height': 768,
		}
		new_canvas([JSON.print(json)])
		yield(get_tree().create_timer(5), "timeout")
		var json2 = {
			'width': 768,
			'height': 432,
		}
		new_canvas([JSON.print(json2)])


const draw_panel:= preload("res://DrawPanel.tscn")

# 새 캔버스 생성하기
func new_canvas(args):
	# 기존에 존재하는 캔버스를 삭제 후 새로 생성함
	var children:= get_children()
	for child in children:
		child.queue_free()
	var json = JSON.parse(args[0]).result
	if json is Dictionary:
		var inst:= draw_panel.instance()
		inst.width = json.width
		inst.height = json.height
		inst.rect_scale = Vector2(0, 0)
		add_child(inst)
	else: printerr('voidDraw: json import error')
