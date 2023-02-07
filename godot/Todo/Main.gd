extends Node


func _ready():
	var inst = load('res://Todo.tscn')
	add_child(inst.instance())
