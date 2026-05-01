from django import template

register = template.Library()


@register.filter
def replace(value, arg):
    """Replace char in string. Usage: {{ value|replace:"old,new" }}"""
    if ',' in arg:
        old, new = arg.split(',', 1)
    else:
        old, new = arg, ''
    return str(value).replace(old, new)


@register.filter
def multiply_by(value, arg):
    """Multiply value by arg. Usage: {{ value|multiply_by:30 }}"""
    try:
        return int(value) * int(arg)
    except (ValueError, TypeError):
        return 0


@register.filter
def get_item(dictionary, key):
    """Get item from dict. Usage: {{ dict|get_item:key }}"""
    if hasattr(dictionary, 'get'):
        return dictionary.get(key, '')
    return ''


@register.filter
def split(value, arg):
    """Split string by delimiter. Usage: {{ value|split:"," }}"""
    return str(value).split(arg)


@register.filter
def divide_1000(value):
    """Divide by 1000 and round to integer. Usage: {{ value|divide_1000 }}"""
    try:
        return round(int(value) / 1000)
    except (ValueError, TypeError):
        return value
