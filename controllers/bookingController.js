// controllers/bookingController.js
const Salon = require('../models/Salon');
const SalonBooking = require('../models/SalonBooking');
const Address = require('../models/Address');
const User = require('../models/User');

exports.getAvailableSlots = async (req, res) => {
  try {
    const { salonId, bookingDate, serviceIds } = req.query;
    
    if (!salonId || !bookingDate || !serviceIds) {
      return res.status(400).json({
        success: false,
        message: 'Salon ID, booking date, and services are required'
      });
    }

    // Parse service IDs
    const serviceIdArray = Array.isArray(serviceIds) 
      ? serviceIds 
      : serviceIds.split(',');

    // Get salon with availability
    const salon = await Salon.findById(salonId);
    if (!salon) {
      return res.status(404).json({
        success: false,
        message: 'Salon not found'
      });
    }

    // Check if salon is closed on this date
    const dateObj = new Date(bookingDate);
    if (salon.closedDates.some(date => 
      new Date(date).toDateString() === dateObj.toDateString()
    )) {
      return res.json({
        success: true,
        availableSlots: [],
        message: 'Salon is closed on this date'
      });
    }

    // Get day of week (0 = Sunday, 1 = Monday, etc.)
    const dayOfWeek = dateObj.getDay();
    
    // Find availability for this day
    const dayAvailability = salon.availability.find(
      avail => avail.dayOfWeek === dayOfWeek
    );

    if (!dayAvailability || !dayAvailability.isOpen) {
      return res.json({
        success: true,
        availableSlots: [],
        message: 'Salon is not available on this day'
      });
    }

    // Get total duration needed for selected services
    const selectedServices = salon.services.filter(service =>
      serviceIdArray.includes(service._id.toString())
    );

    if (selectedServices.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Selected services not found'
      });
    }

    const totalDuration = selectedServices.reduce(
      (sum, service) => sum + (service.durationMinutes || 60), 0
    );

    // Get existing bookings for this date
    const existingBookings = await SalonBooking.find({
      'salon.salonId': salonId,
      bookingDate: {
        $gte: new Date(dateObj.setHours(0, 0, 0, 0)),
        $lt: new Date(dateObj.setHours(24, 0, 0, 0))
      },
      status: { $nin: ['cancelled_by_user', 'cancelled_by_salon', 'rejected'] }
    });

    // Generate available slots
    const availableSlots = [];
    const slotDuration = salon.slotDurationMinutes || 60;
    
    // Convert time string to minutes since midnight
    const timeToMinutes = (timeStr) => {
      const [hours, minutes] = timeStr.split(':').map(Number);
      return hours * 60 + minutes;
    };

    // Convert minutes to time string
    const minutesToTime = (minutes) => {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    };

    const startTime = timeToMinutes(dayAvailability.openingTime);
    const endTime = timeToMinutes(dayAvailability.closingTime);
    const breakSlots = dayAvailability.breakSlots || [];

    // Check each possible slot
    for (let time = startTime; time <= endTime - totalDuration; time += slotDuration) {
      const slotStart = minutesToTime(time);
      const slotEnd = minutesToTime(time + totalDuration);
      
      // Skip if overlaps with break
      const isDuringBreak = breakSlots.some(breakSlot => {
        const breakStart = timeToMinutes(breakSlot.start);
        const breakEnd = timeToMinutes(breakSlot.end);
        return time < breakEnd && (time + totalDuration) > breakStart;
      });

      if (isDuringBreak) continue;

      // Check if slot is already booked
      const isBooked = existingBookings.some(booking => {
        const bookingTime = timeToMinutes(booking.bookingTime);
        const bookingEnd = bookingTime + (booking.totalDuration || 60);
        return time < bookingEnd && (time + totalDuration) > bookingTime;
      });

      if (!isBooked) {
        availableSlots.push({
          startTime: slotStart,
          endTime: slotEnd,
          duration: totalDuration
        });
      }
    }

    res.json({
      success: true,
      availableSlots,
      totalDuration,
      salonTimings: {
        openingTime: dayAvailability.openingTime,
        closingTime: dayAvailability.closingTime
      }
    });

  } catch (error) {
    console.error('Error fetching slots:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch available slots'
    });
  }
};

exports.createBooking = async (req, res) => {
    try {
      const {
        salonId,
        serviceIds,
        bookingDate,
        bookingTime,
        bookingType,
        addressId,
        paymentMethod
      } = req.body;
  
      const userId = req.session.user.id;
  
      // Validate required fields
      if (!salonId || !serviceIds || !bookingDate || !bookingTime) {
        return res.status(400).json({
          success: false,
          message: 'Missing required booking information'
        });
      }
  
      // Get user
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
  
      // Get salon
      const salon = await Salon.findById(salonId);
      if (!salon) {
        return res.status(404).json({
          success: false,
          message: 'Salon not found'
        });
      }
  
      // Parse service IDs
      const serviceIdArray = Array.isArray(serviceIds) 
        ? serviceIds 
        : serviceIds.split(',');
  
      // Get selected services
      const selectedServices = salon.services.filter(service =>
        serviceIdArray.includes(service._id.toString())
      );
  
      if (selectedServices.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No valid services selected'
        });
      }
  
      // Calculate totals
      const totalServiceAmount = selectedServices.reduce(
        (sum, service) => sum + service.price, 0
      );
      const totalAdminPrice = selectedServices.reduce(
        (sum, service) => sum + service.adminPrice, 0
      );
      const totalDuration = selectedServices.reduce(
        (sum, service) => sum + (service.durationMinutes || 60), 0
      );
  
      // Add home service charge if applicable
      let homeServiceCharge = 0;
      let homeServiceAddress = null;
  
      if (bookingType === 'home') {
        if (!addressId) {
          return res.status(400).json({
            success: false,
            message: 'Address required for home service'
          });
        }
  
        if (!salon.serviceMode.homeService) {
          return res.status(400).json({
            success: false,
            message: 'This salon does not offer home services'
          });
        }
  
        // Get address
        const address = await Address.findOne({
          _id: addressId,
          userId: userId
        });
  
        if (!address) {
          return res.status(404).json({
            success: false,
            message: 'Address not found'
          });
        }
  
        homeServiceAddress = {
          fullAddress: `${address.addressLine1}, ${address.addressLine2 || ''}, ${address.city}, ${address.state} - ${address.zipCode}`,
          city: address.city,
          state: address.state,
          pincode: address.zipCode
        };
  
        // Calculate home service charge
        homeServiceCharge = salon.serviceMode.homeServiceExtraCharge || 0;
      }
  
      // Check slot availability
      const dateObj = new Date(bookingDate);
      const dayOfWeek = dateObj.getDay();
      const dayAvailability = salon.availability.find(
        avail => avail.dayOfWeek === dayOfWeek
      );
  
      if (!dayAvailability || !dayAvailability.isOpen) {
        return res.status(400).json({
          success: false,
          message: 'Salon is not available on this day'
        });
      }
  
      // Check for existing bookings at this time
      const existingBooking = await SalonBooking.findOne({
        'salon.salonId': salonId,
        bookingDate: dateObj,
        bookingTime: bookingTime,
        status: { $nin: ['cancelled_by_user', 'cancelled_by_salon', 'rejected'] }
      });
  
      if (existingBooking) {
        return res.status(400).json({
          success: false,
          message: 'This time slot is already booked'
        });
      }
  
      // Generate booking token
      const bookingToken = `SALON-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
  
      // Prepare services data
      const bookingServices = selectedServices.map(service => ({
        serviceId: service._id,
        serviceName: service.serviceName,
        basePrice: service.price,
        adminPrice: service.adminPrice,
        durationMinutes: service.durationMinutes || 60
      }));
  
      // Calculate payment breakdown
      const finalTotal = totalServiceAmount + homeServiceCharge;
      const salonEarning = totalServiceAmount - totalAdminPrice;
  
      // Create booking
      const booking = new SalonBooking({
        bookingToken,
        user: {
          userId: user._id,
          name: user.name,
          phone: user.phone,
          email: user.email
        },
        salon: {
          salonId: salon._id,
          salonName: salon.name,
          salonPhone: salon.phone
        },
        services: bookingServices,
        bookingType: bookingType || 'salon',
        bookingDate: dateObj,
        bookingTime,
        totalDuration,
        paymentBreakdown: {
          totalServiceAmount: finalTotal,
          customerPaid: finalTotal,
          salonEarning: salonEarning,
          homeServiceCharge: homeServiceCharge
        },
        payment: {
          method: paymentMethod || 'online',
          status: paymentMethod === 'cod' ? 'pending' : 'pending'
        },
        status: 'pending'
      });
  
      // Add location based on booking type
      if (bookingType === 'home') {
        booking.homeServiceLocation = homeServiceAddress;
      } else {
        booking.salonLocation = {
          address: `${salon.address.line1}, ${salon.address.city}, ${salon.address.state} - ${salon.address.pincode}`,
          googleMapLink: salon.googleMapLink
        };
      }
  
      await booking.save();
  
      // Update salon statistics
      await Salon.findByIdAndUpdate(salonId, {
        $inc: { totalBookings: 1 }
      });
  
      // Send notification to user
      user.notifications.push({
        message: `Your salon booking #${bookingToken} has been created successfully`,
        read: false,
        createdAt: new Date()
      });
      await user.save();
  
      res.json({
        success: true,
        message: 'Booking created successfully',
        booking: {
          id: booking._id,
          token: booking.bookingToken,
          totalAmount: finalTotal,
          bookingDate: booking.bookingDate,
          bookingTime: booking.bookingTime,
          status: booking.status
        }
      });
  
    } catch (error) {
      console.error('Error creating booking:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create booking'
      });
    }
  };

  // bookingController.js continued
exports.getBookingDetails = async (req, res) => {
    try {
      const { bookingId } = req.params;
      const userId = req.session.user.id;
  
      const booking = await SalonBooking.findOne({
        _id: bookingId,
        'user.userId': userId
      }).populate('salon.salonId');
  
      if (!booking) {
        return res.status(404).json({
          success: false,
          message: 'Booking not found'
        });
      }
  
      res.json({
        success: true,
        booking
      });
  
    } catch (error) {
      console.error('Error fetching booking:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch booking details'
      });
    }
  };
  
  exports.getUserBookings = async (req, res) => {
    try {
      const userId = req.session.user.id;
      const { status, page = 1, limit = 10 } = req.query;
  
      const query = { 'user.userId': userId };
      if (status && status !== 'all') {
        query.status = status;
      }
  
      const skip = (page - 1) * limit;
      
      const [bookings, total] = await Promise.all([
        SalonBooking.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(Number(limit))
          .populate('salon.salonId', 'name images'),
        SalonBooking.countDocuments(query)
      ]);
  
      res.json({
        success: true,
        bookings,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });
  
    } catch (error) {
      console.error('Error fetching user bookings:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch bookings'
      });
    }
  };
  
  exports.cancelBooking = async (req, res) => {
    try {
      const { bookingId } = req.params;
      const userId = req.session.user.id;
  
      const booking = await SalonBooking.findOne({
        _id: bookingId,
        'user.userId': userId
      });
  
      if (!booking) {
        return res.status(404).json({
          success: false,
          message: 'Booking not found'
        });
      }
  
      // Check if booking can be cancelled
      if (booking.status !== 'pending' && booking.status !== 'confirmed') {
        return res.status(400).json({
          success: false,
          message: 'Booking cannot be cancelled at this stage'
        });
      }
  
      // Check if booking is within cancellation window (e.g., 2 hours before)
      const bookingDateTime = new Date(
        `${booking.bookingDate.toDateString()} ${booking.bookingTime}`
      );
      const hoursBefore = (bookingDateTime - new Date()) / (1000 * 60 * 60);
  
      if (hoursBefore < 2) {
        return res.status(400).json({
          success: false,
          message: 'Cannot cancel booking less than 2 hours before appointment'
        });
      }
  
      // Update booking status
      booking.status = 'cancelled_by_user';
      booking.cancelledAt = new Date();
      await booking.save();
  
      // Send notification to user
      const user = await User.findById(userId);
      if (user) {
        user.notifications.push({
          message: `Your booking #${booking.bookingToken} has been cancelled`,
          read: false,
          createdAt: new Date()
        });
        await user.save();
      }
  
      res.json({
        success: true,
        message: 'Booking cancelled successfully'
      });
  
    } catch (error) {
      console.error('Error cancelling booking:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to cancel booking'
      });
    }
  };