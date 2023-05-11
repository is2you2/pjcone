extends Node


func _ready():
	var inst = load('res://voidDraw.tscn')
	add_child(inst.instance())
