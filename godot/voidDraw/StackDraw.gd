extends Control


var is_pressed:= false
var current_draw:Line2D

var color:= Color.black
var weight:= 3

onready var parent:= get_node('../../..')

func _on_StackDraw_gui_input(event):
	if event is InputEventMouseButton:
		match(event.button_index):
			1: # 좌클릭
				if event.is_pressed():
					is_pressed = true
					current_draw = Line2D.new()
					current_draw.default_color = color
					current_draw.width = weight
					current_draw.joint_mode = Line2D.LINE_JOINT_ROUND
					current_draw.begin_cap_mode = Line2D.LINE_CAP_ROUND
					current_draw.end_cap_mode = Line2D.LINE_CAP_ROUND
					add_child(current_draw)
					current_draw.add_point(event.position)
					var children:= get_children()
					for child in children:
						if not child.visible:
							child.queue_free()
					parent.window.current_act = children.size()
					parent.window.draw_length = parent.window.current_act
				else:
					if current_draw.points.size() == 1:
						current_draw.queue_free()
						parent.window.current_act = get_child_count()
						parent.window.draw_length = parent.window.current_act
					is_pressed = false
	if event is InputEventMouseMotion:
		if is_pressed:
			current_draw.add_point(event.position)


func save_image():
	var viewport:Viewport = get_node('../..')
	var img:= viewport.get_texture().get_data()
	img.flip_y()
	var buf:= img.save_png_to_buffer()
	var base64:= Marshalls.raw_to_base64(buf)
	get_node('../../..').use_canvas(base64)
