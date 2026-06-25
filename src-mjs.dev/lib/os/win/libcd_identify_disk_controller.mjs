/**
 * get_disk_controllers - this determines via the unique id of the disk.. which controller it lives under
 * therefore, we can then hopefully determine its type. 
 * 
 * If the type isnt a motherboard controller, then we can assume its externally plugged into the host system
 */

// creates a set hierarchy of controllers
// one disk can only belong to one controller

