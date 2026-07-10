# acl mask

1. can probe name and records
2. can descend root
3. can descend children

# read mask

1. can query root dirs
2. can query root dirs children
3. can seek node size

4. is a vector this allows orders of magnitude and " size of work "

# speed mask

1. no restrictions
2. must be exclusive
3. must be system controlled ( TODO (matt): is it possible to know when you can do stuff in the background more intelligently? )

# activity mask

1. missing
2. present
3. busy ( 2+1 )

# history mask

-- indicates readings from previous operations... TODO (matt): when more coupled to the os... 


## TODO

- the vol strategies are almost hte same thing... this makes me think to redesign as behavioural more.. since the operations are similar
