extends Control


var parent_node


func _ready():
	parent_node = get_node("../../..")


func _draw():
	draw_arc(rect_size / 2, rect_size.x / 2 - 3, deg2rad(-90), deg2rad(lerp(-90, 270, parent_node.lerp_value)), lerp(8, 24, parent_node.lerp_value), parent_node.line_color, 6, true)
