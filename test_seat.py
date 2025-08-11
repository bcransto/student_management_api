from students.models import SeatingAssignment, SeatingPeriod, ClassRoster

# Test data
period = SeatingPeriod.objects.get(id=14)
roster_entry = ClassRoster.objects.get(id=8)
seat_id = '3-2'

print(f"Period: {period}")
print(f"Period Layout: {period.layout}")
print(f"Roster Entry: {roster_entry}")

# Try to create the assignment
assignment = SeatingAssignment(
    seating_period=period,
    roster_entry=roster_entry,
    seat_id=seat_id
)

try:
    assignment.full_clean()
    assignment.save()
    print("SUCCESS!")
except Exception as e:
    print(f"ERROR: {e}")
    import traceback
    traceback.print_exc()