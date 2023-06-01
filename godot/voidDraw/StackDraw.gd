extends Control


var is_pressed:= false
# 판넬 조정시 false
var is_drawable:= true
var current_draw:Line2D

var color:= Color.black
var weight:= 3

onready var parent:= get_node('../../..')

func _on_StackDraw_gui_input(event):
	if event is InputEventMouseButton or event is InputEventScreenTouch:
		var index = 1 if event is InputEventScreenTouch else event.button_index
		match(index):
			1: # 좌클릭
				if event.is_pressed():
					if is_pressed or not is_drawable: return
					is_pressed = true
					current_draw = Line2D.new()
					current_draw.default_color = color
					current_draw.width = weight
					current_draw.joint_mode = Line2D.LINE_JOINT_ROUND
					current_draw.begin_cap_mode = Line2D.LINE_CAP_ROUND
					current_draw.end_cap_mode = Line2D.LINE_CAP_ROUND
					add_child(current_draw)
					var children:= get_children()
					for child in children:
						if not child.visible:
							child.queue_free()
					if parent.window:
						parent.window.current_act = children.size()
						parent.window.draw_length = parent.window.current_act
				elif is_pressed:
					if current_draw.points.size() == 1:
						remove_current_draw()
					is_pressed = false
	if event is InputEventMouseMotion:
		if is_pressed and is_drawable:
			current_draw.add_point(event.position)

# 현재 그리기를 취소하고 그리기가 동작하지 않도록 막음
func remove_current_draw():
	current_draw.queue_free()
	if parent.window:
		parent.window.current_act = get_child_count()
		parent.window.draw_length = parent.window.current_act
	is_pressed = false

func save_image():
	var viewport:Viewport = get_node('../..')
	var img:= viewport.get_texture().get_data()
	img.flip_y()
	var buf:= img.save_png_to_buffer()
	var base64:= Marshalls.raw_to_base64(buf)
	get_node('../../..').use_canvas(base64)
