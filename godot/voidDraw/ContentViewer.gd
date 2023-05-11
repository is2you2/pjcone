extends Node


func _ready():
	var inst = load('res://Main.tscn')
	add_child(inst.instance())
